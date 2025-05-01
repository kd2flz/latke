use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use thiserror::Error;
use tokio::time::sleep;
use std::pin::Pin;
use std::future::Future;

const API_BASE_URL: &str = "https://api.ibroadcast.com/s/JSON";
const TOKEN_REFRESH_THRESHOLD: Duration = Duration::from_secs(300); // 5 minutes
const MAX_RETRIES: u32 = 3;
const RETRY_DELAY: Duration = Duration::from_secs(1);
const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(60);
const MAX_REQUESTS_PER_WINDOW: u32 = 60;

#[derive(Debug, Error)]
pub enum IBroadcastError {
    #[error("Authentication failed: {0}")]
    Authentication(String),
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("API error: {0}")]
    Api(String),
    #[error("Invalid response format: {0}")]
    InvalidResponse(String),
    #[error("Not logged in")]
    NotLoggedIn,
    #[error("HTTP error: {0}")]
    Http(reqwest::StatusCode),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user_id: String,
    pub token: String,
    pub status: String,
    pub expires: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryResponse {
    pub status: String,
    pub library: serde_json::Value,
    pub playlists: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaybackResponse {
    pub status: String,
    pub stream_url: String,
    pub duration: i64,
    pub bitrate: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaylistResponse {
    pub status: String,
    pub playlist_id: String,
    pub name: String,
}

pub struct IBroadcastClient {
    client: reqwest::Client,
    token: Option<String>,
    token_expires: Option<SystemTime>,
    user_id: Option<String>,
    request_count: u32,
    last_request_time: SystemTime,
}

impl IBroadcastClient {
    /// Creates a new iBroadcast API client
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            token: None,
            token_expires: None,
            user_id: None,
            request_count: 0,
            last_request_time: SystemTime::now(),
        }
    }

    /// Handles rate limiting by checking and updating request counts
    async fn check_rate_limit(&mut self) -> Result<(), IBroadcastError> {
        let now = SystemTime::now();
        if now.duration_since(self.last_request_time).unwrap_or(Duration::ZERO) > RATE_LIMIT_WINDOW {
            self.request_count = 0;
            self.last_request_time = now;
        }

        if self.request_count >= MAX_REQUESTS_PER_WINDOW {
            return Err(IBroadcastError::RateLimitExceeded);
        }

        self.request_count += 1;
        Ok(())
    }

    /// Makes an API request with retry logic
    async fn make_request<T: for<'de> Deserialize<'de>>(
        &mut self,
        params: HashMap<String, String>,
    ) -> Result<T, IBroadcastError> {
        self.check_rate_limit().await?;
        self.ensure_valid_token().await?;

        let mut retries = 0;
        loop {
            match self
                .client
                .post(API_BASE_URL)
                .form(&params)
                .send()
                .await
            {
                Ok(response) => {
                    if response.status().is_success() {
                        return response.json::<T>().await.map_err(|e| {
                            IBroadcastError::InvalidResponse(format!("Failed to parse response: {}", e))
                        });
                    } else if response.status().as_u16() == 429 {
                        if retries < MAX_RETRIES {
                            retries += 1;
                            sleep(RETRY_DELAY * retries).await;
                            continue;
                        }
                        return Err(IBroadcastError::RateLimitExceeded);
                    } else {
                        let error: ErrorResponse = response.json().await.unwrap_or(ErrorResponse {
                            status: "error".to_string(),
                            message: "Unknown error".to_string(),
                        });
                        return Err(IBroadcastError::Api(error.message));
                    }
                }
                Err(e) => {
                    if retries < MAX_RETRIES {
                        retries += 1;
                        sleep(RETRY_DELAY * retries).await;
                        continue;
                    }
                    return Err(IBroadcastError::Network(e));
                }
            }
        }
    }

    /// Authenticates with the iBroadcast API using email and password
    pub async fn login(&mut self, email: &str, password: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "login".to_string());
        params.insert("email".to_string(), email.to_string());
        params.insert("password".to_string(), password.to_string());

        let response = self.make_request::<LoginResponse>(params).await?;
        if response.status == "OK" {
            self.token = Some(response.token);
            self.user_id = Some(response.user_id);
            if let Some(expires) = response.expires {
                self.token_expires = Some(SystemTime::now() + Duration::from_secs(expires as u64));
            }
            Ok(())
        } else {
            Err(IBroadcastError::Authentication(response.status))
        }
    }

    fn ensure_valid_token(&mut self) -> Pin<Box<dyn Future<Output = Result<(), IBroadcastError>> + '_>> {
        Box::pin(async move {
            if let Some(expires) = self.token_expires {
                if SystemTime::now() + TOKEN_REFRESH_THRESHOLD > expires {
                    let mut params = HashMap::new();
                    params.insert("mode".to_string(), "refresh".to_string());
                    params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.to_string());

                    let response = self.make_request::<LoginResponse>(params).await?;
                    if response.status == "OK" {
                        self.token = Some(response.token);
                        if let Some(expires) = response.expires {
                            self.token_expires = Some(SystemTime::now() + Duration::from_secs(expires as u64));
                        }
                    } else {
                        return Err(IBroadcastError::Authentication(response.status));
                    }
                }
            }
            Ok(())
        })
    }

    /// Retrieves the user's music library
    pub async fn get_library(&mut self) -> Result<LibraryResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "getlibrary".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        self.make_request::<LibraryResponse>(params).await
    }

    /// Gets the stream URL for a specific track
    pub async fn get_stream_url(&mut self, track_id: &str) -> Result<PlaybackResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "stream".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.to_string());
        params.insert("id".to_string(), track_id.to_string());

        self.make_request::<PlaybackResponse>(params).await
    }

    /// Searches the music library
    pub async fn search(&mut self, query: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "search".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.to_string());
        params.insert("query".to_string(), query.to_string());

        self.make_request::<serde_json::Value>(params).await
    }

    /// Creates a new playlist
    pub async fn create_playlist(&mut self, name: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "createplaylist".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        params.insert("name".to_string(), name.to_string());
        self.make_request::<serde_json::Value>(params).await?;
        Ok(())
    }

    /// Adds a track to a playlist
    pub async fn add_to_playlist(&mut self, playlist_id: &str, media_id: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "addtoplaylist".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        params.insert("playlist_id".to_string(), playlist_id.to_string());
        params.insert("media_id".to_string(), media_id.to_string());
        self.make_request::<serde_json::Value>(params).await?;
        Ok(())
    }

    /// Removes a track from a playlist
    pub async fn remove_from_playlist(&mut self, playlist_id: &str, media_id: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "removefromplaylist".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        params.insert("playlist_id".to_string(), playlist_id.to_string());
        params.insert("media_id".to_string(), media_id.to_string());
        self.make_request::<serde_json::Value>(params).await?;
        Ok(())
    }

    /// Deletes a playlist
    pub async fn delete_playlist(&mut self, playlist_id: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "deleteplaylist".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.to_string());
        params.insert("playlist_id".to_string(), playlist_id.to_string());

        self.make_request::<serde_json::Value>(params).await
    }

    /// Gets the current playback status
    pub async fn get_playback_status(&mut self) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "getplaybackstatus".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.to_string());

        self.make_request::<serde_json::Value>(params).await
    }

    pub async fn get_playback(&mut self) -> Result<PlaybackResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "getplayback".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        self.make_request::<PlaybackResponse>(params).await
    }

    pub async fn play(&mut self, media_id: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "play".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        params.insert("media_id".to_string(), media_id.to_string());
        self.make_request::<serde_json::Value>(params).await?;
        Ok(())
    }

    pub async fn get_playlists(&mut self) -> Result<PlaylistResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "getplaylists".to_string());
        params.insert("token".to_string(), self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?.clone());
        self.make_request::<PlaylistResponse>(params).await
    }
} 
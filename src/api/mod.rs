use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use thiserror::Error;
use tokio::time::sleep;

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
        params: HashMap<&str, &str>,
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
                        // Rate limit hit
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
    pub async fn login(&mut self, email: &str, password: &str) -> Result<LoginResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "login");
        params.insert("email", email);
        params.insert("password", password);

        let response = self.make_request::<LoginResponse>(params).await?;

        if response.status == "OK" {
            self.token = Some(response.token.clone());
            self.user_id = Some(response.user_id.clone());
            if let Some(expires) = response.expires {
                self.token_expires = Some(SystemTime::now() + Duration::from_secs(expires as u64));
            }
        } else {
            return Err(IBroadcastError::Authentication(response.status));
        }

        Ok(response)
    }

    /// Ensures the authentication token is valid and refreshes it if necessary
    async fn ensure_valid_token(&mut self) -> Result<(), IBroadcastError> {
        if let Some(expires) = self.token_expires {
            if SystemTime::now() + TOKEN_REFRESH_THRESHOLD > expires {
                let mut params = HashMap::new();
                params.insert("mode", "refresh");
                params.insert("token", self.token.as_ref().ok_or_else(|| {
                    IBroadcastError::Authentication("No token available".to_string())
                })?);

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
    }

    /// Retrieves the user's music library
    pub async fn get_library(&mut self) -> Result<LibraryResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "getlibrary");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);

        self.make_request::<LibraryResponse>(params).await
    }

    /// Gets the stream URL for a specific track
    pub async fn get_stream_url(&mut self, track_id: &str) -> Result<PlaybackResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "stream");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("id", track_id);

        self.make_request::<PlaybackResponse>(params).await
    }

    /// Searches the music library
    pub async fn search(&mut self, query: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "search");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("query", query);

        self.make_request::<serde_json::Value>(params).await
    }

    /// Creates a new playlist
    pub async fn create_playlist(&mut self, name: &str) -> Result<PlaylistResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "createplaylist");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("name", name);

        self.make_request::<PlaylistResponse>(params).await
    }

    /// Adds a track to a playlist
    pub async fn add_to_playlist(&mut self, playlist_id: &str, track_id: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "addtoplaylist");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("playlist_id", playlist_id);
        params.insert("track_id", track_id);

        self.make_request::<serde_json::Value>(params).await
    }

    /// Removes a track from a playlist
    pub async fn remove_from_playlist(&mut self, playlist_id: &str, track_id: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "removefromplaylist");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("playlist_id", playlist_id);
        params.insert("track_id", track_id);

        self.make_request::<serde_json::Value>(params).await
    }

    /// Deletes a playlist
    pub async fn delete_playlist(&mut self, playlist_id: &str) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "deleteplaylist");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);
        params.insert("playlist_id", playlist_id);

        self.make_request::<serde_json::Value>(params).await
    }

    /// Gets the current playback status
    pub async fn get_playback_status(&mut self) -> Result<serde_json::Value, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode", "getplaybackstatus");
        params.insert("token", self.token.as_ref().ok_or_else(|| {
            IBroadcastError::Authentication("Not authenticated".to_string())
        })?);

        self.make_request::<serde_json::Value>(params).await
    }
} 
use anyhow::Result;
use chrono::{Utc, Datelike};
use reqwest::blocking;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use thiserror::Error;

const API_BASE_URL: &str = "https://api.ibroadcast.com/s/JSON";
const DEVICE_AUTH_URL: &str = "https://api.ibroadcast.com/s/JSON/device";
const LIBRARY_URL: &str = "https://library.ibroadcast.com";
const ARTWORK_URL: &str = "https://artwork.ibroadcast.com/artwork";
const STREAMING_URL: &str = "https://streaming.ibroadcast.com";
const WEBSOCKET_URL: &str = "wss://queue.ibroadcast.com/ws";

#[derive(Debug, Error)]
pub enum IBroadcastError {
    #[error("Authentication failed: {0}")]
    Authentication(String),
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Network error: {0}")]
    Network(String),
    #[error("API error: {0}")]
    Api(String),
    #[error("Invalid response format: {0}")]
    InvalidResponse(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Not logged in")]
    NotLoggedIn,
}

impl From<reqwest::Error> for IBroadcastError {
    fn from(err: reqwest::Error) -> Self {
        IBroadcastError::Network(err.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub message: String,
    pub authenticated: bool,
    pub result: bool,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub user: Option<UserInfo>,
    #[serde(default)]
    pub expires: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    pub mode: String,
    pub client: String,
    pub device_name: String,
    pub version: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    pub result: bool,
    pub message: String,
    #[serde(default)]
    pub settings: Option<Settings>,
    #[serde(default)]
    pub status: Option<Status>,
    pub authenticated: bool,
    #[serde(default)]
    pub user: Option<UserInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Settings {
    pub artwork_server: String,
    pub streaming_server: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Status {
    pub lastmodified: String,
    pub plays: i32,
    pub available: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub session_uuid: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email_address: Option<String>,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub session: Option<Session>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: String,
    pub message: String,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub message: String,
    pub result: bool,
    #[serde(default)]
    pub device_code: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
    #[serde(default)]
    pub authenticated: bool,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub user: Option<UserInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueUpdate {
    pub queue_id: String,
    pub track_ids: Vec<String>,
    pub current_position: usize,
    pub is_playing: bool,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueCommand {
    pub command: String,
    pub queue_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub event: String,
    pub data: serde_json::Value,
}

pub struct IBroadcastClient {
    client: blocking::Client,
    token: Option<String>,
    user_id: Option<String>,
    device_name: String,
    client_name: String,
    version: String,
    request_count: u32,
    last_request_time: SystemTime,
    token_expires: Option<SystemTime>,
    library: Option<LibraryResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackInfo {
    pub file_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: i64,
    pub bitrate: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Album {
    pub id: String,
    pub title: String,
    pub track_ids: Vec<u64>,
    pub cover_id: Option<u64>,
    pub is_various_artists: bool,
    pub disc_number: u32,
    pub total_discs: u32,
    pub year: u32,
    pub extra: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub track_ids: Vec<u64>,
    pub cover_id: Option<u64>,
    pub is_smart: bool,
    pub user_id: Option<u64>,
    pub extra: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryData {
    #[serde(default)]
    pub albums: HashMap<String, (String, Vec<u64>, u64, bool, u32, u32, u32, Vec<serde_json::Value>)>,
    #[serde(default)]
    pub playlists: HashMap<String, (String, Vec<u64>, u64, bool, u32, u32, u32, Vec<serde_json::Value>)>,
    #[serde(default)]
    pub tracks: HashMap<String, TrackInfo>,
    #[serde(default)]
    pub settings: Option<Settings>,
    #[serde(default)]
    pub expires: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryResponse {
    pub result: bool,
    #[serde(default)]
    pub library: Option<LibraryData>,
    #[serde(default)]
    pub status: Option<Status>,
    #[serde(default)]
    pub settings: Option<Settings>,
}

impl IBroadcastClient {
    /// Creates a new iBroadcast API client
    pub fn new() -> Self {
        Self {
            client: blocking::Client::new(),
            token: None,
            user_id: None,
            device_name: String::from("desktop"),
            client_name: String::from("Latke Desktop Client"),
            version: env!("CARGO_PKG_VERSION").to_string(),
            request_count: 0,
            last_request_time: SystemTime::now(),
            token_expires: None,
            library: None,
        }
    }

    /// Adds common parameters required for all API requests
    fn add_common_params(&self, params: &mut HashMap<String, String>) {
        params.insert("client".to_string(), self.client_name.clone());
        params.insert("device_name".to_string(), self.device_name.clone());
        params.insert("version".to_string(), self.version.clone());
        
        if let Some(user_id) = &self.user_id {
            params.insert("user_id".to_string(), user_id.clone());
        }
        if let Some(token) = &self.token {
            params.insert("token".to_string(), token.clone());
        }
    }

    /// Handles rate limiting by checking and updating request counts
    async fn check_rate_limit(&mut self) -> Result<(), IBroadcastError> {
        let now = SystemTime::now();
        if now.duration_since(self.last_request_time).unwrap_or(Duration::ZERO) > Duration::from_secs(60) {
            self.request_count = 0;
            self.last_request_time = now;
        }

        if self.request_count >= 60 {
            return Err(IBroadcastError::RateLimitExceeded);
        }

        self.request_count += 1;
        Ok(())
    }

    /// Makes an API request with retry logic
    fn make_request<T: for<'de> Deserialize<'de>>(
        &mut self,
        mut params: HashMap<String, serde_json::Value>,
    ) -> Result<T, IBroadcastError> {
        let mut retries = 0;
        loop {
            let endpoint = match params.get("mode").and_then(|v| v.as_str()) {
                Some("library") => LIBRARY_URL,
                _ => API_BASE_URL,
            };
            let response = self
                .client
                .post(endpoint)
                .header("Content-Type", "application/json")
                .json(&params)
                .send()?;
            match response.status() {
                status if status.is_success() => {
                    if let Some("library") = params.get("mode").and_then(|v| v.as_str()) {
                        return response.json::<T>()
                            .map_err(|e| IBroadcastError::InvalidResponse(format!("Failed to parse response: {}", e)));
                    }
                    let api_response = response.json::<ApiResponse>()
                        .map_err(|e| IBroadcastError::InvalidResponse(format!("Failed to parse response: {}", e)))?;
                    if !api_response.result {
                        return Err(IBroadcastError::Api(api_response.message));
                    }
                    let json_value = serde_json::to_value(&api_response)
                        .map_err(|e| IBroadcastError::InvalidResponse(format!("Failed to serialize response: {}", e)))?;
                    return serde_json::from_value(json_value)
                        .map_err(|e| IBroadcastError::InvalidResponse(format!("Failed to parse response into requested type: {}", e)));
                }
                status if status.as_u16() == 429 => {
                    if retries < 3 {
                        retries += 1;
                        std::thread::sleep(Duration::from_secs(1) * retries);
                        continue;
                    }
                    return Err(IBroadcastError::RateLimitExceeded);
                }
                _ => {
                    let error = response.json::<ErrorResponse>().unwrap_or(ErrorResponse {
                        status: "error".to_string(),
                        message: "Unknown error".to_string(),
                    });
                    return Err(IBroadcastError::Api(error.message));
                }
            }
        }
    }

    /// Authenticates with the iBroadcast API using email and password
    // Synchronous version
    pub fn login(&mut self, email: &str, password: &str) -> Result<(), IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "status".into());
        params.insert("email_address".to_string(), email.into());
        params.insert("password".to_string(), password.into());

        let response: ApiResponse = self.make_request(params)?;

        if response.authenticated {
            if let Some(user) = response.user {
                self.user_id = Some(user.id);
                self.token = user.token;
                Ok(())
            } else {
                Err(IBroadcastError::Authentication("No user info received".to_string()))
            }
        } else {
            Err(IBroadcastError::Authentication(response.message))
        }
    }

    /// Get library
    pub fn get_library(&mut self) -> Result<LibraryResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), "library".into());
        self.make_request(params)
    }

    /// Record playback after 10 seconds
    pub async fn record_play(&mut self, track_id: &str) -> Result<(), IBroadcastError> {
        let now = Utc::now();
        let day = format!("{:02}-{:02}-{}", 
            now.month(), now.day(), now.year());

        let mut plays = HashMap::new();
        plays.insert(track_id.to_string(), 1);

        let history = vec![serde_json::json!({
            "day": day,
            "plays": plays,
        })];

        let mut params = HashMap::new();
        params.insert("mode".to_string(), "status".into());
        params.insert("history".to_string(), serde_json::to_value(history)?);

        self.make_request::<ApiResponse>(params)?;
        Ok(())
    }

    /// Record skip event
    pub async fn record_skip(&mut self, track_id: &str) -> Result<(), IBroadcastError> {
        let now = Utc::now();
        
        let mut details = HashMap::new();
        details.insert(track_id.to_string(), serde_json::json!({
            "event": "skip",
            "ts": now.to_rfc3339(),
        }));

        let history = vec![serde_json::json!({
            "day": now.format("%m-%d-%Y").to_string(),
            "detail": details,
        })];

        let mut params = HashMap::new();
        params.insert("mode".to_string(), "status".into());
        params.insert("history".to_string(), serde_json::to_value(history)?);

        self.make_request::<ApiResponse>(params)?;
        Ok(())
    }

    /// Get streaming URL for a track
    pub async fn get_stream_url(&mut self, track_id: &str) -> Result<String, IBroadcastError> {
        if let Some(library) = self.library.as_ref() {
            // Verify track exists
            let _ = library.library.as_ref().unwrap().tracks.get(track_id)
                .ok_or_else(|| IBroadcastError::Api("Track not found".to_string()))?;
            
            let url = format!("{}?Expires={}&Signature={}&platform=desktop&version={}&user_id={}&file_id={}",
                library.library.as_ref().unwrap().settings.as_ref().unwrap().streaming_server,
                library.library.as_ref().unwrap().expires.unwrap_or_default(),
                self.token.as_ref().ok_or(IBroadcastError::NotLoggedIn)?,
                self.version,
                self.user_id.as_ref().ok_or(IBroadcastError::NotLoggedIn)?,
                track_id
            );
            
            Ok(url)
        } else {
            Err(IBroadcastError::Api("Library not loaded".to_string()))
        }
    }
    
    /// Initiates device code authentication flow
    pub async fn get_device_code(&mut self) -> Result<DeviceCodeResponse, IBroadcastError> {
        let mut params = HashMap::new();
        params.insert("mode".to_string(), serde_json::json!("getdevicecode"));
        params.insert("app".to_string(), serde_json::json!("Latke"));
        params.insert("version".to_string(), serde_json::json!(env!("CARGO_PKG_VERSION")));
        params.insert("device".to_string(), serde_json::json!("desktop"));
        params.insert("client".to_string(), serde_json::json!("Latke Desktop Client"));

        self.make_request::<DeviceCodeResponse>(params)
    }

    /// Polls for device code authentication completion
    pub async fn poll_device_code(&mut self, login_token: &str, device_name: &str) -> Result<DeviceCodeResponse, IBroadcastError> {
        let params = serde_json::json!({
            "login_token": login_token,
            "device_name": device_name,
            "client": "latke",
            "app_id": 1166,
            "version": "1.0.0",
            "type": "account",
            "mode": "login_token"
        });

        let url = "https://api.ibroadcast.com/s/JSON/";
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(reqwest::header::CONTENT_TYPE, "application/json".parse().unwrap());
        headers.insert(reqwest::header::ACCEPT, "application/json".parse().unwrap());
        headers.insert(reqwest::header::USER_AGENT, "PostmanRuntime/7.32.3".parse().unwrap());

        log::debug!("=== API Request Details ===");
        log::debug!("URL: {}", url);
        log::debug!("Method: POST");
        log::debug!("Headers:");
        log::debug!("  Content-Type: application/json");
        log::debug!("  Accept: application/json");
        log::debug!("  User-Agent: PostmanRuntime/7.32.3");
        log::debug!("Request Body: {}", params.to_string());
        log::debug!("========================");

        let response = self
            .client
            .request(reqwest::Method::POST, url)
            .headers(headers)
            .json(&params)
            .send()?;

        log::debug!("=== API Response Details ===");
        log::debug!("Status: {}", response.status());
        log::debug!("Headers:");
        for (name, value) in response.headers() {
            log::debug!("  {}: {}", name, value.to_str().unwrap_or("(invalid)"));
        }
        let response_text = response.text()?;
        log::debug!("Response Body: {}", response_text);
        log::debug!("=========================");

        let response: DeviceCodeResponse = serde_json::from_str(&response_text).map_err(|e| {
            IBroadcastError::InvalidResponse(format!("Failed to parse response: {}", e))
        })?;

        if response.authenticated && response.result {
            if let Some(token) = response.token.clone() {
                self.token = Some(token);
                if let Some(user) = response.user.clone() {
                    self.user_id = Some(user.id);
                }
            }
        }

        Ok(response)
    }
}
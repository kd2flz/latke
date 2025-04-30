use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const API_BASE_URL: &str = "https://api.ibroadcast.com/s/JSON";

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user_id: String,
    pub token: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub status: String,
    pub message: String,
}

pub struct IBroadcastClient {
    client: reqwest::Client,
    token: Option<String>,
}

impl IBroadcastClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            token: None,
        }
    }

    pub async fn login(&mut self, email: &str, password: &str) -> Result<LoginResponse> {
        let mut params = HashMap::new();
        params.insert("mode", "login");
        params.insert("email", email);
        params.insert("password", password);

        let response = self
            .client
            .post(API_BASE_URL)
            .form(&params)
            .send()
            .await?
            .json::<LoginResponse>()
            .await?;

        if response.status == "OK" {
            self.token = Some(response.token.clone());
        }

        Ok(response)
    }

    pub async fn get_library(&self) -> Result<serde_json::Value> {
        if self.token.is_none() {
            return Err(anyhow::anyhow!("Not authenticated"));
        }

        let mut params = HashMap::new();
        params.insert("mode", "getlibrary");
        params.insert("token", self.token.as_ref().unwrap());

        let response = self
            .client
            .post(API_BASE_URL)
            .form(&params)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        Ok(response)
    }
} 
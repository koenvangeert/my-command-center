use tauri::State;
use serde::Serialize;
use crate::opencode_client::OpenCodeClient;

#[derive(Serialize)]
pub struct OpenCodeStatus {
    pub api_url: String,
    pub healthy: bool,
    pub version: Option<String>,
}

/// Get OpenCode server status and API URL
#[tauri::command]
pub async fn get_opencode_status(
    client: State<'_, OpenCodeClient>,
) -> Result<OpenCodeStatus, String> {
    let health = client
        .health()
        .await
        .map_err(|e| format!("Health check failed: {}", e))?;
    
    Ok(OpenCodeStatus {
        api_url: "http://127.0.0.1:4096".to_string(),
        healthy: health.healthy,
        version: health.version,
    })
}

/// Get list of available agents from OpenCode server
#[tauri::command]
pub async fn get_agents(
    client: State<'_, OpenCodeClient>,
) -> Result<Vec<crate::opencode_client::AgentInfo>, String> {
    client
        .list_agents()
        .await
        .map_err(|e| format!("Failed to get agents: {}", e))
}

/// Create a new OpenCode session
#[tauri::command]
pub async fn create_session(
    client: State<'_, OpenCodeClient>,
    title: String,
) -> Result<String, String> {
    client
        .create_session(title)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))
}

/// Send a prompt to an OpenCode session
#[tauri::command]
pub async fn send_prompt(
    client: State<'_, OpenCodeClient>,
    session_id: String,
    text: String,
) -> Result<serde_json::Value, String> {
    client
        .send_prompt(&session_id, text)
        .await
        .map_err(|e| format!("Failed to send prompt: {}", e))
}

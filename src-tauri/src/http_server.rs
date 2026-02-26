use axum::{
    extract::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

/// Request to spawn a new task from OpenCode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnRequest {
    pub title: String,
    pub description: Option<String>,
    pub project_id: Option<String>,
}

/// Response containing the created task ID
#[derive(Debug, Clone, Serialize)]
pub struct SpawnResponse {
    pub task_id: String,
    pub status: String,
}

/// Handle spawn_task requests (mock implementation)
/// 
/// Currently returns a mock task ID. The actual task creation logic
/// will be implemented in a future task.
pub async fn spawn_task_handler(
    Json(_request): Json<SpawnRequest>,
) -> Json<SpawnResponse> {
    Json(SpawnResponse {
        task_id: "T-MOCK".to_string(),
        status: "created".to_string(),
    })
}

/// Create the HTTP router with all available routes
pub fn create_router() -> Router {
    Router::new()
        .route("/spawn_task", post(spawn_task_handler))
}

/// Start the HTTP server on the configured port
/// 
/// The server listens on 127.0.0.1 (localhost only) to ensure
/// it's not exposed to the external network.
/// 
/// The port can be configured via the AI_COMMAND_CENTER_PORT
/// environment variable, defaulting to 17422.
pub async fn start_http_server() -> Result<(), Box<dyn std::error::Error>> {
    let port = std::env::var("AI_COMMAND_CENTER_PORT")
        .unwrap_or_else(|_| "17422".to_string())
        .parse::<u16>()
        .unwrap_or(17422);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let app = create_router();

    println!("[http_server] Starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_request_creation() {
        let request = SpawnRequest {
            title: "Test Task".to_string(),
            description: Some("Test description".to_string()),
            project_id: Some("PROJ-1".to_string()),
        };
        assert_eq!(request.title, "Test Task");
    }

    #[test]
    fn test_spawn_response_creation() {
        let response = SpawnResponse {
            task_id: "T-123".to_string(),
            status: "created".to_string(),
        };
        assert_eq!(response.task_id, "T-123");
        assert_eq!(response.status, "created");
    }
}

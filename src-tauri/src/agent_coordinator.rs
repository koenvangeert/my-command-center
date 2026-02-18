//! Agent Coordinator
//!
//! Simplified coordinator that replaces the old checkpoint-based orchestrator.
//! Creates an OpenCode session, sends a fire-and-forget prompt, and lets SSE handle the rest.
//!
//! No stages, no checkpoints — just start implementation and monitor via SSE events.

use crate::db::Database;
use crate::opencode_client::{OpenCodeClient, OpenCodeError};
use std::fmt;

/// Coordinator errors
#[derive(Debug)]
pub enum CoordinatorError {
    TaskNotFound(String),
    SessionCreationFailed(String),
    PromptFailed(String),
    AbortFailed(String),
    DatabaseError(String),
}

impl fmt::Display for CoordinatorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoordinatorError::TaskNotFound(msg) => write!(f, "Task not found: {}", msg),
            CoordinatorError::SessionCreationFailed(msg) => {
                write!(f, "Session creation failed: {}", msg)
            }
            CoordinatorError::PromptFailed(msg) => write!(f, "Prompt failed: {}", msg),
            CoordinatorError::AbortFailed(msg) => write!(f, "Abort failed: {}", msg),
            CoordinatorError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
        }
    }
}

impl std::error::Error for CoordinatorError {}

impl From<rusqlite::Error> for CoordinatorError {
    fn from(e: rusqlite::Error) -> Self {
        CoordinatorError::DatabaseError(e.to_string())
    }
}

impl From<OpenCodeError> for CoordinatorError {
    fn from(e: OpenCodeError) -> Self {
        match e {
            OpenCodeError::NetworkError(msg) => CoordinatorError::SessionCreationFailed(msg),
            OpenCodeError::ApiError { status, message } => {
                CoordinatorError::SessionCreationFailed(format!("API error {}: {}", status, message))
            }
            OpenCodeError::ParseError(msg) => CoordinatorError::SessionCreationFailed(msg),
        }
    }
}

/// Start implementation for a task
///
/// Creates an OpenCode session, builds a prompt from task context, and sends it asynchronously.
/// Returns the agent session ID for tracking.
///
/// # Arguments
/// * `db` - Database reference
/// * `app` - Tauri app handle (unused for now, kept for future event emission)
/// * `task_id` - Task ID to implement
/// * `server_port` - OpenCode server port
///
/// # Returns
/// Agent session ID on success
pub async fn start_implementation(
    db: &Database,
    app: &tauri::AppHandle,
    task_id: &str,
    server_port: u16,
) -> Result<String, CoordinatorError> {
    let task = db
        .get_task(task_id)?
        .ok_or_else(|| CoordinatorError::TaskNotFound(format!("Task {} not found", task_id)))?;

    let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", server_port));

    let opencode_session_id = client
        .create_session(format!("Task {}", task_id))
        .await
        .map_err(|e| CoordinatorError::SessionCreationFailed(e.to_string()))?;

    let mut prompt = format!("You are working on task {}: {}\n\n", task_id, task.title);

    if let Some(ref description) = task.description {
        if !description.is_empty() {
            prompt.push_str(description);
            prompt.push_str("\n\n");
        }
    }

    if let Some(ref acceptance_criteria) = task.acceptance_criteria {
        if !acceptance_criteria.is_empty() {
            prompt.push_str("Acceptance Criteria:\n");
            prompt.push_str(acceptance_criteria);
            prompt.push_str("\n\n");
        }
    }

    prompt.push_str(
        "Implement this task. Create a branch, make the changes, and create a pull request when done.",
    );

    client
        .prompt_async(&opencode_session_id, prompt, None)
        .await
        .map_err(|e| CoordinatorError::PromptFailed(e.to_string()))?;

    let agent_session_id = uuid::Uuid::new_v4().to_string();
    db.create_agent_session(
        &agent_session_id,
        task_id,
        Some(&opencode_session_id),
        "implementing",
        "running",
    )?;

    let _ = app;

    Ok(agent_session_id)
}

/// Abort implementation for a task
///
/// Finds the latest running agent session for the task and aborts the OpenCode session.
///
/// # Arguments
/// * `db` - Database reference
/// * `app` - Tauri app handle (unused for now, kept for future event emission)
/// * `task_id` - Task ID to abort
/// * `server_port` - OpenCode server port
///
/// # Returns
/// Ok on success
pub async fn abort_implementation(
    db: &Database,
    app: &tauri::AppHandle,
    task_id: &str,
    server_port: u16,
) -> Result<(), CoordinatorError> {
    let session = db
        .get_latest_session_for_ticket(task_id)?
        .ok_or_else(|| {
            CoordinatorError::TaskNotFound(format!("No session found for task {}", task_id))
        })?;

    let opencode_session_id = session.opencode_session_id.ok_or_else(|| {
        CoordinatorError::AbortFailed(format!("Session {} has no OpenCode session ID", session.id))
    })?;

    let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", server_port));

    client
        .abort_session(&opencode_session_id)
        .await
        .map_err(|e| CoordinatorError::AbortFailed(e.to_string()))?;

    db.update_agent_session(&session.id, "implementing", "failed", None, Some("Aborted by user"))?;

    let _ = app;

    Ok(())
}

/// Handle implementation completion
///
/// Called when SSE detects that the agent has completed the task.
/// Updates the agent session status to "completed".
///
/// # Arguments
/// * `db` - Database reference
/// * `task_id` - Task ID that completed
///
/// # Returns
/// Ok on success
pub async fn handle_implementation_complete(
    db: &Database,
    task_id: &str,
) -> Result<(), CoordinatorError> {
    let session = db
        .get_latest_session_for_ticket(task_id)?
        .ok_or_else(|| {
            CoordinatorError::TaskNotFound(format!("No session found for task {}", task_id))
        })?;

    db.update_agent_session(&session.id, &session.stage, "completed", None, None)?;

    Ok(())
}

/// Handle implementation failure
///
/// Called when SSE detects that the agent has failed.
/// Updates the agent session status to "failed" with error message.
///
/// # Arguments
/// * `db` - Database reference
/// * `task_id` - Task ID that failed
/// * `error` - Error message
///
/// # Returns
/// Ok on success
pub async fn handle_implementation_failed(
    db: &Database,
    task_id: &str,
    error: &str,
) -> Result<(), CoordinatorError> {
    let session = db
        .get_latest_session_for_ticket(task_id)?
        .ok_or_else(|| {
            CoordinatorError::TaskNotFound(format!("No session found for task {}", task_id))
        })?;

    db.update_agent_session(&session.id, &session.stage, "failed", None, Some(error))?;

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = CoordinatorError::TaskNotFound("TASK-123".to_string());
        assert_eq!(err.to_string(), "Task not found: TASK-123");

        let err = CoordinatorError::SessionCreationFailed("connection refused".to_string());
        assert_eq!(err.to_string(), "Session creation failed: connection refused");

        let err = CoordinatorError::PromptFailed("timeout".to_string());
        assert_eq!(err.to_string(), "Prompt failed: timeout");

        let err = CoordinatorError::AbortFailed("not found".to_string());
        assert_eq!(err.to_string(), "Abort failed: not found");

        let err = CoordinatorError::DatabaseError("locked".to_string());
        assert_eq!(err.to_string(), "Database error: locked");
    }
}

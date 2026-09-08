//! Routes only the explicitly selected indexed shell. All other callers retain the old adapter.
use super::{pty_payload::*, *};
use crate::app_events::RuntimeEventPublisher;

pub(super) async fn handle(
    state: &AppState,
    request: &AppInvokeRequest,
) -> AppResult<Option<serde_json::Value>> {
    let Some(bridge) = state
        .pty_manager
        .as_ref()
        .and_then(|manager| manager.daemon_shells.as_ref())
    else {
        return Ok(None);
    };
    let publisher = RuntimeEventPublisher::new(state.app.clone(), state.app_event_tx.clone());
    let value = match request.command.as_str() {
        "pty_spawn_shell" => {
            let payload = PtySpawnShellPayload::decode(&request.command, &request.payload)?;
            let key =
                crate::pty_manager::shell_session_key(&payload.task_id, payload.terminal_index);
            if payload.terminal_index.is_none() || !bridge.owns(&key) {
                return Ok(None);
            }
            let command = bridge
                .prepare_shell(
                    payload.cwd.into(),
                    payload.cols,
                    payload.rows,
                    payload.terminal_image_protocol,
                )
                .map_err(error)?;
            json_value(bridge.spawn(command, publisher).await.map_err(error)?)?
        }
        "pty_write" => {
            let payload = PtyWritePayload::decode(&request.command, &request.payload)?;
            if !bridge.owns(&payload.shell_session_key) {
                return Ok(None);
            }
            bridge
                .write(payload.data.into_bytes(), publisher)
                .await
                .map_err(error)?;
            serde_json::Value::Null
        }
        "pty_resize" => {
            let payload = PtyResizePayload::decode(&request.command, &request.payload)?;
            if !bridge.owns(&payload.shell_session_key) {
                return Ok(None);
            }
            bridge
                .resize(payload.cols, payload.rows, publisher)
                .await
                .map_err(error)?;
            serde_json::Value::Null
        }
        "pty_kill" => {
            let payload = PtyShellSessionPayload::decode(&request.command, &request.payload)?;
            if !bridge.owns(&payload.shell_session_key) {
                return Ok(None);
            }
            bridge.terminate(publisher).await.map_err(error)?;
            serde_json::Value::Null
        }
        "pty_kill_shells_for_task" => {
            let payload = PtyTaskPayload::decode(&request.command, &request.payload)?;
            if bridge.belongs_to_task(&payload.task_id) {
                bridge.terminate(publisher).await.map_err(error)?;
            }
            // Legacy shells of the same Task still need their existing scoped cleanup.
            return Ok(None);
        }
        "get_pty_buffer" => {
            let payload = PtyShellSessionPayload::decode(&request.command, &request.payload)?;
            if !bridge.owns(&payload.shell_session_key) {
                return Ok(None);
            }
            json_value(bridge.buffer(publisher).await.map_err(error)?)?
        }
        _ => return Ok(None),
    };
    Ok(Some(value))
}

fn error(message: String) -> (StatusCode, String) {
    (StatusCode::SERVICE_UNAVAILABLE, message)
}

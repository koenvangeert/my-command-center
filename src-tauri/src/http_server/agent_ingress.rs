//! Private Sidecar boundary for daemon forwarding. Domain validation stays here.
use super::AppState;
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

pub(super) async fn authorize(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let Some(daemon) = state
        .pty_manager
        .as_ref()
        .and_then(|manager| manager.daemon_shells.as_ref())
    else {
        return next.run(request).await;
    };
    if let Err(error) = super::authentication::require_backend_token(&state, request.headers()) {
        return error.into_response();
    }
    if request
        .headers()
        .keys()
        .any(|key| key.as_str().starts_with("x-openforge-agent-"))
    {
        if !openforge_session_protocol::agent_route_allowed(
            request.method().as_str(),
            request.uri().path(),
        ) {
            return (StatusCode::FORBIDDEN, "agent route forbidden").into_response();
        }
        let Some((task, session, installation, instance)) = ownership(request.headers()) else {
            return (StatusCode::FORBIDDEN, "invalid agent ownership").into_response();
        };
        let task_exists = crate::db::acquire_db(&state.db)
            .get_task(&task)
            .is_ok_and(|task| task.is_some());
        if !task_exists
            || daemon
                .validate_agent_owner(
                    crate::app_events::RuntimeEventPublisher::new(
                        state.app.clone(),
                        state.app_event_tx.clone(),
                    ),
                    task,
                    session,
                    installation,
                    instance,
                )
                .await
                .is_err()
        {
            return (StatusCode::FORBIDDEN, "agent Task/session unavailable").into_response();
        }
    }
    next.run(request).await
}

fn ownership(headers: &HeaderMap) -> Option<(String, String, String, u64)> {
    let field = |name| {
        headers
            .get(name)?
            .to_str()
            .ok()
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
    };
    Some((
        field("x-openforge-agent-task")?,
        field("x-openforge-agent-session")?,
        field("x-openforge-agent-installation")?,
        field("x-openforge-agent-instance")?.parse().ok()?,
    ))
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn private_sidecar_rejects_direct_cli_and_forged_agent_ownership() {
        let (mut state, root) = crate::test_support::test_state("private_agent_ingress", |_, _| {});
        let mut manager = crate::pty_manager::PtyManager::new();
        manager.enable_daemon_shell(
            root.path().into(),
            "/unused-daemon".into(),
            "T-fixture-shell-0".into(),
        );
        state.pty_manager = Some(manager);
        state.backend_token = Some("controller-only".into());
        let router = super::super::create_router(state);
        for path in ["/projects", "/debug/process-memory", "/app/health"] {
            let response = router
                .clone()
                .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
        }
        let response = router
            .oneshot(
                Request::builder()
                    .uri("/projects")
                    .header("authorization", "Bearer controller-only")
                    .header("x-openforge-agent-task", "forged")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}

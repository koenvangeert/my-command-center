//! Transport allowlist, not domain dispatch. Hooks and controller routes are deliberately absent.
pub fn agent_route_allowed(method: &str, path: &str) -> bool {
    let segments: Vec<_> = path.strip_prefix('/').unwrap_or("").split('/').collect();
    if !path.starts_with('/')
        || segments.iter().any(|s| {
            s.is_empty()
                || !s
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        })
    {
        return false;
    }
    match method {
        "POST" => matches!(
            path,
            "/create_task"
                | "/start_task"
                | "/update_task"
                | "/delete_task"
                | "/hard_delete_task"
                | "/set_task_dependencies"
                | "/add_task_dependency"
                | "/link_task_chain"
                | "/add_task_label"
                | "/remove_task_label"
                | "/install_plugin_from_local"
                | "/set_plugin_enabled"
                | "/set_app_plugin_enabled"
                | "/reload_plugin"
                | "/plugin_commands/list"
                | "/plugin_commands/describe"
                | "/plugin_commands/invoke"
        ),
        "GET" => matches!(
            segments.as_slice(),
            ["projects"]
                | ["tasks"]
                | ["task", _]
                | ["task", _, "labels"]
                | ["project", _, "labels"]
                | ["project", _, "attention"]
                | ["v2", "projects", _, "tasks", _]
                | ["debug", "process-memory"]
                | ["debug", "process-memory", "history"]
        ),
        _ => false,
    }
}

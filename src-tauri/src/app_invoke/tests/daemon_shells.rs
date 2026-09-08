use super::*;

#[tokio::test]
#[ignore = "build the Session Daemon first; run with the session-daemon contract command"]
async fn indexed_daemon_shell_reattaches_through_existing_ipc_after_sidecar_state_replacement() {
    let root = tempfile::Builder::new()
        .prefix("of-ipc-")
        .tempdir_in("/tmp")
        .unwrap();
    let executable = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("crates/session-daemon/target/debug/openforge-session-daemon");
    let (mut first, _first_db) = test_state("daemon-shell-first");
    first.pty_manager.as_mut().unwrap().enable_daemon_shell(
        root.path().into(),
        executable.clone(),
        "T-daemon-shell-3".into(),
    );
    let instance = invoke_ok(&first, "pty_spawn_shell", json!({ "taskId": "T-daemon", "terminalIndex": 3, "cwd": root.path(), "cols": 80, "rows": 24 })).await;
    invoke_ok(
        &first,
        "pty_write",
        json!({ "shellSessionKey": "T-daemon-shell-3", "data": "kept_across_sidecars=yes\n" }),
    )
    .await;
    drop(first);
    let (mut second, _second_db) = test_state("daemon-shell-second");
    second.pty_manager.as_mut().unwrap().enable_daemon_shell(
        root.path().into(),
        executable,
        "T-daemon-shell-3".into(),
    );
    let replay = invoke_ok(
        &second,
        "get_pty_buffer",
        json!({"shellSessionKey":"T-daemon-shell-3"}),
    )
    .await;
    assert_eq!(replay["instanceId"], instance);
    assert_eq!(replay["isLive"], true);
    assert!(replay["snapshot"]["continuationData"].is_string());
    let same = invoke_ok(&second, "pty_spawn_shell", json!({ "taskId": "T-daemon", "terminalIndex": 3, "cwd": root.path(), "cols": 80, "rows": 24 })).await;
    assert_eq!(
        same, instance,
        "reattachment must not spawn a replacement shell"
    );
    invoke_ok(
        &second,
        "pty_kill",
        json!({ "shellSessionKey": "T-daemon-shell-3" }),
    )
    .await;
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    loop {
        let replay = invoke_ok(
            &second,
            "get_pty_buffer",
            json!({ "shellSessionKey": "T-daemon-shell-3" }),
        )
        .await;
        if replay["isLive"] == false {
            break;
        }
        assert!(tokio::time::Instant::now() < deadline);
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    drop(second);
    let client = openforge_session_client::Client::connect(root.path()).unwrap();
    client.shutdown_empty().unwrap();
}

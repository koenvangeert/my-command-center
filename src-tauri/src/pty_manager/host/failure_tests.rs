use super::contract_tests::{installation, operation, shell, ExistingFixture};
use super::*;

#[tokio::test]
async fn cancelled_spawn_finishes_and_reconciles_without_reexecution() {
    let (host, reached, release) = deterministic::paused_host(installation());
    let controller = host.connect(&installation()).await.unwrap().controller;
    let request = shell(std::path::Path::new("/tmp"));
    let worker = host.clone();
    let old_controller = controller.clone();
    let old_request = request.clone();
    let spawn = tokio::spawn(async move {
        worker
            .spawn(&old_controller, operation("cancelled"), old_request)
            .await
    });
    reached.await.unwrap();
    spawn.abort();
    assert!(spawn.await.unwrap_err().is_cancelled());
    drop(release);
    let reconnected = host.connect(&installation()).await.unwrap();
    assert_eq!(reconnected.inventory.len(), 1);
    assert_eq!(
        host.spawn(&reconnected.controller, operation("cancelled"), request)
            .await
            .unwrap(),
        reconnected.inventory[0].pty
    );
    assert_eq!(
        host.reconcile(&reconnected.controller).await.unwrap().len(),
        1
    );
    host.terminate(
        &reconnected.controller,
        operation("stop-cancelled"),
        &reconnected.inventory[0].pty,
    )
    .await
    .unwrap();
}

#[tokio::test]
async fn retention_refuses_new_operations_without_forgetting_spawn_receipts() {
    let host = deterministic::host(installation());
    let controller = host.connect(&installation()).await.unwrap().controller;
    let request = shell(std::path::Path::new("/tmp"));
    let pty = host
        .spawn(&controller, operation("retained-spawn"), request.clone())
        .await
        .unwrap();
    for sequence in 1..MAX_OPERATIONS {
        host.io(
            &controller,
            operation(&format!("io-{sequence}")),
            IoRequest {
                pty: pty.clone(),
                sequence: sequence as u64,
                action: IoAction::Resize {
                    columns: 80,
                    rows: 24,
                },
            },
        )
        .await
        .unwrap();
    }
    assert_eq!(
        host.spawn(&controller, operation("overflow"), request.clone())
            .await,
        Err(HostError::Capacity)
    );
    assert_eq!(
        host.spawn(&controller, operation("retained-spawn"), request)
            .await
            .unwrap(),
        pty
    );
    // Reconciliation is always available even when mutation receipt retention is full.
    assert_eq!(host.reconcile(&controller).await.unwrap().len(), 1);
    host.terminate(&controller, operation("stop-at-capacity"), &pty)
        .await
        .unwrap();
    assert_eq!(
        host.reconcile(&controller).await.unwrap()[0].state,
        HostedSessionState::Exited
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn host_handles_share_fencing_and_refuse_a_foreign_installation() {
    let fixture = ExistingFixture::new();
    let events = crate::app_events::AppEventBus::new(256, 256);
    let host = fixture.manager.host(installation(), events.clone());
    let alias = fixture.manager.clone().host(installation(), events.clone());
    let foreign = fixture
        .manager
        .host(InstallationId::parse("foreign").unwrap(), events);
    let controller = host.connect(&installation()).await.unwrap().controller;
    assert_eq!(
        foreign.reconcile(&controller).await,
        Err(HostError::ForeignInstallation)
    );
    let next = alias.connect(&installation()).await.unwrap().controller;
    assert_eq!(
        host.reconcile(&controller).await,
        Err(HostError::StaleController)
    );
    assert!(host.reconcile(&next).await.unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn existing_host_retains_failed_spawn_without_retrying_a_changed_executable() {
    use std::os::unix::fs::PermissionsExt;
    let fixture = ExistingFixture::new();
    let host = fixture.host();
    let controller = host.connect(&installation()).await.unwrap().controller;
    let executable = fixture.directory.path().join("later-created");
    let mut request = shell(fixture.directory.path());
    request.command.program = executable.to_str().unwrap().into();
    let failed = host
        .spawn(&controller, operation("failed"), request.clone())
        .await;
    assert!(matches!(failed, Err(HostError::Backend(_))));
    std::fs::write(&executable, "#!/bin/sh\nexec /bin/sh \"$@\"\n").unwrap();
    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(
        host.spawn(&controller, operation("failed"), request).await,
        failed
    );
    assert!(host.reconcile(&controller).await.unwrap().is_empty());
}

#[tokio::test]
async fn legacy_sessions_remain_reconcilable_when_exit_history_is_full() {
    let (host, controls) = deterministic::controlled_host(installation());
    let controller = host.connect(&installation()).await.unwrap().controller;
    let mut recorded = shell(std::path::Path::new("/tmp"));
    recorded.owner = TerminalOwner::Agent {
        task_id: "recorded".into(),
    };
    let first = host
        .spawn(&controller, operation("recorded"), recorded.clone())
        .await
        .unwrap();
    host.terminate(&controller, operation("stop-recorded"), &first)
        .await
        .unwrap();
    let legacy = shell(std::path::Path::new("/tmp"));
    for _ in 0..MAX_SESSIONS - 1 {
        controls.legacy_spawn(&legacy).await;
        host.reconcile(&controller).await.unwrap();
    }
    // A legacy caller bypasses host admission while its history is already full.
    let mut additional = legacy;
    additional.owner = TerminalOwner::Shell {
        task_id: "host-contract".into(),
        index: Some(1),
    };
    let extra = controls.legacy_spawn(&additional).await;
    let inventory = host.reconcile(&controller).await.unwrap();
    assert!(inventory
        .iter()
        .any(|item| item.pty.instance == extra && item.state == HostedSessionState::Live));
    let next = host.connect(&installation()).await.unwrap();
    for _ in 0..4 {
        controls.legacy_spawn(&additional).await;
        host.reconcile(&next.controller).await.unwrap();
    }
    let inventory = host.reconcile(&next.controller).await.unwrap();
    assert_eq!(
        inventory
            .iter()
            .filter(|item| item.state == HostedSessionState::Live)
            .count(),
        2
    );
    assert!(
        inventory
            .iter()
            .filter(|item| item.state == HostedSessionState::Exited)
            .count()
            <= MAX_SESSIONS
    );
    // Expiring old exit history must not expire the idempotent spawn receipt.
    assert_eq!(
        host.spawn(&next.controller, operation("recorded"), recorded)
            .await
            .unwrap(),
        first
    );
    assert!(!inventory.iter().any(|item| item.pty == first));
}

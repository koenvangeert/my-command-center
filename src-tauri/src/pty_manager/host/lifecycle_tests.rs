use super::contract_tests::{installation, operation, shell, ExistingFixture};
use super::*;
use std::path::Path;

async fn scope_contract(host: &impl PtyHost, cwd: &Path) {
    let controller = host.connect(&installation()).await.unwrap().controller;
    assert!(matches!(
        host.connect(&InstallationId::parse("foreign").unwrap())
            .await,
        Err(HostError::ForeignInstallation)
    ));
    let request = shell(cwd);
    let mut invalid = vec![];
    let mut item = request.clone();
    item.columns = 0;
    invalid.push(item);
    let mut item = request.clone();
    item.command.program.clear();
    invalid.push(item);
    let mut item = request.clone();
    item.command.args.push("bad\0argument".into());
    invalid.push(item);
    let mut item = request.clone();
    item.command.env.insert("BAD=KEY".into(), "value".into());
    invalid.push(item);
    let mut item = request.clone();
    item.command.cwd = "relative".into();
    invalid.push(item);
    let mut item = request.clone();
    item.command.args.push("x".repeat(MAX_REQUEST_BYTES));
    invalid.push(item);
    let mut item = request.clone();
    item.owner = TerminalOwner::Agent {
        task_id: "../escape".into(),
    };
    invalid.push(item);
    for request in invalid {
        assert!(host
            .spawn(&controller, operation("invalid"), request)
            .await
            .is_err());
        assert!(host.reconcile(&controller).await.unwrap().is_empty());
    }
    let (first, retry) = tokio::join!(
        host.spawn(&controller, operation("spawn-0"), request.clone()),
        host.spawn(&controller, operation("spawn-0"), request.clone()),
    );
    let first = first.unwrap();
    assert_eq!(first, retry.unwrap());
    let mut another = request.clone();
    another.owner = TerminalOwner::Shell {
        task_id: "host-contract".into(),
        index: Some(1),
    };
    let second = host
        .spawn(&controller, operation("spawn-1"), another)
        .await
        .unwrap();
    let mut agent = request.clone();
    agent.owner = TerminalOwner::Agent {
        task_id: "host-contract".into(),
    };
    let agent = host
        .spawn(&controller, operation("spawn-agent"), agent)
        .await
        .unwrap();
    assert_eq!(host.reconcile(&controller).await.unwrap().len(), 3);

    let mut attachment = host
        .attach_recover(&controller, &first, None)
        .await
        .unwrap();
    host.io(
        &controller,
        operation("resize"),
        IoRequest {
            pty: first.clone(),
            sequence: 1,
            action: IoAction::Resize {
                columns: 101,
                rows: 41,
            },
        },
    )
    .await
    .unwrap();
    host.io(
        &controller,
        operation("size"),
        IoRequest {
            pty: first.clone(),
            sequence: 2,
            action: IoAction::Write(b"size\n".to_vec()),
        },
    )
    .await
    .unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        let mut output = Vec::new();
        loop {
            match attachment.recv().await.unwrap() {
                HostOutput::Output { data, .. } => output.extend(data),
                HostOutput::RecoveryRequired => {
                    attachment = host
                        .attach_recover(&controller, &first, None)
                        .await
                        .unwrap();
                    output = base64::Engine::decode(
                        &base64::engine::general_purpose::STANDARD,
                        &attachment.snapshot.compatibility_data,
                    )
                    .unwrap();
                }
                other => panic!("unexpected terminal event: {other:?}"),
            }
            if String::from_utf8_lossy(&output).contains("41 101") {
                break;
            }
        }
    })
    .await
    .unwrap();

    let replacement = host
        .spawn(&controller, operation("spawn-replacement"), request.clone())
        .await
        .unwrap();
    assert_ne!(replacement, first);
    assert_eq!(
        host.terminate(&controller, operation("stale-stop"), &first)
            .await,
        Err(HostError::StalePty)
    );
    assert_eq!(
        host.io(
            &controller,
            operation("stale-input"),
            IoRequest {
                pty: first.clone(),
                sequence: 3,
                action: IoAction::Write(b"wrong\n".to_vec())
            }
        )
        .await,
        Err(HostError::StalePty)
    );
    let reconnected = host.connect(&installation()).await.unwrap();
    assert_eq!(
        host.spawn(&reconnected.controller, operation("spawn-0"), request)
            .await
            .unwrap(),
        first
    );
    for (index, pty) in [replacement, second, agent].iter().enumerate() {
        host.terminate(
            &reconnected.controller,
            operation(&format!("stop-{index}")),
            pty,
        )
        .await
        .unwrap();
        let inventory = host.reconcile(&reconnected.controller).await.unwrap();
        assert_eq!(
            inventory
                .iter()
                .filter(|entry| entry.state == HostedSessionState::Live)
                .count(),
            2 - index
        );
    }
}

#[tokio::test]
async fn deterministic_adapter_scopes_mutations_and_validates_requests() {
    scope_contract(&deterministic::host(installation()), Path::new("/tmp")).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn existing_adapter_scopes_mutations_and_validates_requests() {
    let fixture = ExistingFixture::new();
    scope_contract(&fixture.host(), fixture.directory.path()).await;
}

async fn handoff_sequence_contract(host: &impl PtyHost, cwd: &Path) {
    let controller = host.connect(&installation()).await.unwrap().controller;
    let pty = host
        .spawn(&controller, operation("handoff-spawn"), shell(cwd))
        .await
        .unwrap();
    host.io(
        &controller,
        operation("before-handoff"),
        IoRequest {
            pty: pty.clone(),
            sequence: 1,
            action: IoAction::Write(b"before\n".to_vec()),
        },
    )
    .await
    .unwrap();
    // A new controller has only the reconciled inventory, not the old writer's counter.
    let reconnected = host.connect(&installation()).await.unwrap();
    let session = &reconnected.inventory[0];
    assert_eq!(session.next_io_sequence, Some(2));
    host.io(
        &reconnected.controller,
        operation("after-handoff"),
        IoRequest {
            pty: session.pty.clone(),
            sequence: session.next_io_sequence.unwrap(),
            action: IoAction::Write(b"after\n".to_vec()),
        },
    )
    .await
    .unwrap();
    let inventory = host.reconcile(&reconnected.controller).await.unwrap();
    assert_eq!(inventory[0].next_io_sequence, Some(3));
    host.io(
        &reconnected.controller,
        operation("resize-after-handoff"),
        IoRequest {
            pty: inventory[0].pty.clone(),
            sequence: inventory[0].next_io_sequence.unwrap(),
            action: IoAction::Resize {
                columns: 100,
                rows: 40,
            },
        },
    )
    .await
    .unwrap();
    host.terminate(&reconnected.controller, operation("stop-handoff"), &pty)
        .await
        .unwrap();
}

#[tokio::test]
async fn deterministic_adapter_recovers_next_io_sequence_on_handoff() {
    handoff_sequence_contract(&deterministic::host(installation()), Path::new("/tmp")).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn existing_adapter_recovers_next_io_sequence_on_handoff() {
    let fixture = ExistingFixture::new();
    handoff_sequence_contract(&fixture.host(), fixture.directory.path()).await;
}

use super::contract_tests::{installation, operation, shell, ExistingFixture};
use super::*;
use base64::Engine;

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn existing_transport_filters_stale_instances_and_fails_closed_on_bad_output() {
    let fixture = ExistingFixture::new();
    let events = crate::app_events::AppEventBus::new(256, 256);
    let host = fixture.manager.host(installation(), events.clone());
    let controller = host.connect(&installation()).await.unwrap().controller;
    let request = shell(fixture.directory.path());
    let key = request.owner.session_key();
    let pty = host
        .spawn(&controller, operation("output"), request)
        .await
        .unwrap();
    let mut attachment = tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let attachment = host.attach_recover(&controller, &pty, None).await.unwrap();
            let replay = base64::engine::general_purpose::STANDARD
                .decode(&attachment.snapshot.compatibility_data)
                .unwrap();
            if String::from_utf8_lossy(&replay).contains("host-ready") {
                break attachment;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    let next = attachment.position.sequence + 1;
    let publisher = crate::app_events::RuntimeEventPublisher::new(None, Some(events.sender()));
    let event_name = format!("pty-model-output-{key}");
    for (instance, text) in [
        (pty.instance.value() + 1, "stale"),
        (pty.instance.value(), "current"),
    ] {
        publisher.publish(
            &event_name,
            &serde_json::json!({
                "instance_id": instance, "start_sequence": next, "sequence": next,
                "data": base64::engine::general_purpose::STANDARD.encode(text),
            }),
        );
    }
    let output = tokio::time::timeout(std::time::Duration::from_secs(2), attachment.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        output,
        HostOutput::Output {
            start: OutputPosition {
                pty: pty.clone(),
                sequence: next
            },
            end: OutputPosition {
                pty: pty.clone(),
                sequence: next
            },
            data: b"current".to_vec(),
        }
    );
    publisher.publish(&event_name, &serde_json::json!({
        "instance_id": pty.instance.value(), "start_sequence": next + 1, "sequence": next + 1, "data": "invalid base64!",
    }));
    assert_eq!(
        attachment.recv().await.unwrap(),
        HostOutput::RecoveryRequired
    );
    assert_eq!(
        attachment.recv().await.unwrap(),
        HostOutput::RecoveryRequired
    );
    assert!(matches!(
        host.attach_recover(
            &controller,
            &pty,
            Some(OutputPosition {
                pty: pty.clone(),
                sequence: u64::MAX
            })
        )
        .await,
        Err(HostError::StaleOutput)
    ));
    host.terminate(&controller, operation("stop-output"), &pty)
        .await
        .unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn natural_exit_remains_in_reconciled_inventory_and_spawn_receipt() {
    let fixture = ExistingFixture::new();
    let host = fixture.host();
    let controller = host.connect(&installation()).await.unwrap().controller;
    let mut request = shell(fixture.directory.path());
    request.command.args = vec!["-c".into(), "read line; exit 0".into()];
    let pty = host
        .spawn(&controller, operation("exits"), request.clone())
        .await
        .unwrap();
    host.io(
        &controller,
        operation("exit-input"),
        IoRequest {
            pty: pty.clone(),
            sequence: 1,
            action: IoAction::Write(b"exit\n".to_vec()),
        },
    )
    .await
    .unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        loop {
            let inventory = host.reconcile(&controller).await.unwrap();
            if inventory[0].state == HostedSessionState::Exited {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    let next = host.connect(&installation()).await.unwrap();
    assert_eq!(next.inventory[0].pty, pty);
    assert_eq!(next.inventory[0].state, HostedSessionState::Exited);
    assert_eq!(
        host.spawn(&next.controller, operation("exits"), request)
            .await
            .unwrap(),
        pty
    );
}

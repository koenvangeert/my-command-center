use super::contract_tests::{installation, operation, shell};
use super::*;
use futures::{poll, FutureExt};
use std::task::Poll;

#[tokio::test]
async fn cancelled_receive_keeps_dequeued_output_and_exit_while_control_is_busy() {
    for exited in [false, true] {
        let (host, controls) = deterministic::controlled_host(installation());
        let controller = host.connect(&installation()).await.unwrap().controller;
        let request = shell(std::path::Path::new("/tmp"));
        let key = request.owner.session_key();
        let pty = host
            .spawn(&controller, operation("first"), request.clone())
            .await
            .unwrap();
        let mut attachment = host.attach_recover(&controller, &pty, None).await.unwrap();
        let sequence = attachment.position.sequence + 1;
        let mut receive = Box::pin(attachment.recv());
        assert!(matches!(poll!(receive.as_mut()), Poll::Pending));

        let (reached, release) = controls.pause_next_spawn().await;
        let mut blocker = request;
        blocker.owner = TerminalOwner::Agent {
            task_id: "blocker".into(),
        };
        let worker = host.clone();
        let worker_controller = controller.clone();
        let spawning = tokio::spawn(async move {
            worker
                .spawn(&worker_controller, operation("blocker"), blocker)
                .await
        });
        reached.await.unwrap();
        let expected = if exited {
            controls.emit_exit(&key).await;
            HostOutput::Exited { pty: pty.clone() }
        } else {
            controls.emit_output(&key, sequence, b"kept".to_vec()).await;
            HostOutput::Output {
                start: OutputPosition {
                    pty: pty.clone(),
                    sequence,
                },
                end: OutputPosition {
                    pty: pty.clone(),
                    sequence,
                },
                data: b"kept".to_vec(),
            }
        };
        // The receive dequeues the event, then waits to validate under the held gate.
        assert!(matches!(poll!(receive.as_mut()), Poll::Pending));
        drop(receive);
        release.send(()).unwrap();
        let blocker = spawning.await.unwrap().unwrap();
        // No further event is sent. Cancellation must not require one to reveal a gap.
        assert_eq!(attachment.recv().now_or_never(), Some(Ok(expected)));
        host.terminate(&controller, operation("stop-first"), &pty)
            .await
            .unwrap();
        host.terminate(&controller, operation("stop-blocker"), &blocker)
            .await
            .unwrap();
    }
}

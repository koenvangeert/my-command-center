//! Fault injection and legacy traffic for tests of the public host contract.
use super::*;

pub(crate) struct Controls(DeterministicBackend);

pub(crate) fn controlled_host(
    installation: InstallationId,
) -> (InProcessHost<DeterministicBackend>, Controls) {
    let backend = DeterministicBackend::default();
    (
        InProcessHost::new(
            backend.clone(),
            installation,
            Arc::new(Mutex::new(HostState::new())),
        ),
        Controls(backend),
    )
}

impl Controls {
    pub(crate) async fn legacy_spawn(&self, request: &SpawnRequest) -> PtyInstanceId {
        self.0.spawn_prepared(request).await.unwrap()
    }

    pub(crate) async fn pause_next_spawn(
        &self,
    ) -> (
        tokio::sync::oneshot::Receiver<()>,
        tokio::sync::oneshot::Sender<()>,
    ) {
        let (reached_tx, reached) = tokio::sync::oneshot::channel();
        let (release, release_rx) = tokio::sync::oneshot::channel();
        *self.0.spawn_pause.lock().await = Some(SpawnPause {
            reached: reached_tx,
            release: release_rx,
        });
        (reached, release)
    }

    pub(crate) async fn emit_output(&self, key: &str, sequence: u64, data: Vec<u8>) {
        self.0
            .sessions
            .lock()
            .await
            .get(key)
            .unwrap()
            .output
            .send(BackendOutput::Output {
                start_sequence: sequence,
                sequence,
                data,
            })
            .unwrap();
    }

    pub(crate) async fn emit_exit(&self, key: &str) {
        self.0
            .sessions
            .lock()
            .await
            .get(key)
            .unwrap()
            .output
            .send(BackendOutput::Exited)
            .unwrap();
    }
}

use std::future::Future;

use super::*;

/// Private adapter boundary. Implementations own no domain policy; they launch prepared
/// commands and preserve the existing terminal authority and process cleanup behavior.
pub(crate) trait HostBackend: Send + Sync + Clone + 'static {
    fn inventory(&self) -> impl Future<Output = Result<Vec<BackendSession>, HostError>> + Send;
    fn spawn_prepared(
        &self,
        request: &SpawnRequest,
    ) -> impl Future<Output = Result<PtyInstanceId, HostError>> + Send;
    fn terminate_exact(
        &self,
        session: &HostedSession,
    ) -> impl Future<Output = Result<(), HostError>> + Send;
    fn attach(
        &self,
        session: &HostedSession,
    ) -> impl Future<Output = Result<BackendAttachment, HostError>> + Send;
    fn operate(
        &self,
        session: &HostedSession,
        action: &IoAction,
    ) -> impl Future<Output = Result<(), HostError>> + Send;
}

pub(crate) struct BackendSession {
    pub(crate) instance: PtyInstanceId,
    pub(crate) session_key: String,
    pub(crate) state: HostedSessionState,
}

pub(crate) struct BackendAttachment {
    pub(crate) snapshot: crate::pty_manager::TerminalViewSnapshot,
    pub(crate) output: Box<dyn BackendOutputStream>,
}

#[derive(Debug, Clone)]
pub(crate) enum BackendOutput {
    Output {
        start_sequence: u64,
        sequence: u64,
        data: Vec<u8>,
    },
    Exited,
    RecoveryRequired,
}

pub(crate) trait BackendOutputStream: Send {
    fn recv(&mut self) -> std::pin::Pin<Box<dyn Future<Output = BackendOutput> + Send + '_>>;
}

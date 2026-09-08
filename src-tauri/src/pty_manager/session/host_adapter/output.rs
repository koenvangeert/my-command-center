use crate::app_events::{AppEventBus, AppEventFrame, AppEventSubscription};
use crate::pty_manager::host::{BackendOutput, BackendOutputStream, HostError, HostedSession};
use base64::Engine;

pub(super) struct ExistingOutput {
    subscription: AppEventSubscription,
    instance_id: u64,
    output_name: String,
    exit_name: String,
    disabled_name: String,
}

impl ExistingOutput {
    pub(super) fn subscribe(
        events: &AppEventBus,
        session: &HostedSession,
    ) -> Result<Self, HostError> {
        Ok(Self {
            subscription: events
                .subscribe(None)
                .map_err(|_| HostError::RecoveryUnavailable)?,
            instance_id: session.pty.instance.value(),
            output_name: format!("pty-model-output-{}", session.session_key),
            exit_name: format!("pty-exit-{}", session.session_key),
            disabled_name: format!("pty-model-disabled-{}", session.session_key),
        })
    }

    async fn next(&mut self) -> BackendOutput {
        loop {
            let event = match self.subscription.recv().await {
                Some(AppEventFrame::Event(event)) => event,
                Some(AppEventFrame::Gap(_)) | None => return BackendOutput::RecoveryRequired,
            };
            if event.event_name != self.output_name
                && event.event_name != self.exit_name
                && event.event_name != self.disabled_name
            {
                continue;
            }
            if event.payload.get("instance_id").and_then(|id| id.as_u64()) != Some(self.instance_id)
            {
                continue;
            }
            if event.event_name == self.exit_name {
                return BackendOutput::Exited;
            }
            if event.event_name == self.disabled_name {
                return BackendOutput::RecoveryRequired;
            }
            let Some(start_sequence) = event
                .payload
                .get("start_sequence")
                .and_then(|value| value.as_u64())
            else {
                return BackendOutput::RecoveryRequired;
            };
            let Some(sequence) = event
                .payload
                .get("sequence")
                .and_then(|value| value.as_u64())
            else {
                return BackendOutput::RecoveryRequired;
            };
            let Some(encoded) = event.payload.get("data").and_then(|value| value.as_str()) else {
                return BackendOutput::RecoveryRequired;
            };
            // The legacy bridge publishes at most 64 KiB per batch. Fail closed on
            // malformed/unbounded frames rather than allocate attacker-sized output.
            if encoded.len() > 4 * (64 * 1024_usize).div_ceil(3) {
                return BackendOutput::RecoveryRequired;
            }
            let Ok(data) = base64::engine::general_purpose::STANDARD.decode(encoded) else {
                return BackendOutput::RecoveryRequired;
            };
            return BackendOutput::Output {
                start_sequence,
                sequence,
                data,
            };
        }
    }
}

impl BackendOutputStream for ExistingOutput {
    fn recv(
        &mut self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = BackendOutput> + Send + '_>> {
        Box::pin(self.next())
    }
}

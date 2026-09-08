use super::backend::{BackendOutput, BackendOutputStream};
use super::*;

/// Subscribe before taking recovery state. Events at/below the snapshot watermark
/// are discarded; gaps or batches straddling it require another full recovery.
/// The legacy event stream cannot split a batched authority frame by watermark.
pub(crate) struct HostAttachment {
    pub(crate) snapshot: crate::pty_manager::TerminalViewSnapshot,
    pub(crate) position: OutputPosition,
    output: Box<dyn BackendOutputStream>,
    // Keep a dequeued event across cancellation while waiting for controller validation.
    pending: Option<BackendOutput>,
    state: Arc<Mutex<HostState>>,
    controller: Controller,
    recovery_required: bool,
}

impl HostAttachment {
    pub(crate) async fn recv(&mut self) -> Result<HostOutput, HostError> {
        loop {
            self.state.lock().await.validate(&self.controller)?;
            if self.recovery_required {
                return Ok(HostOutput::RecoveryRequired);
            }
            if self.pending.is_none() {
                self.pending = Some(self.output.recv().await);
            }
            self.state.lock().await.validate(&self.controller)?;
            let event = self
                .pending
                .take()
                .expect("event is retained before validating control");
            match event {
                BackendOutput::Output {
                    start_sequence,
                    sequence,
                    data,
                } => {
                    if sequence <= self.position.sequence {
                        continue;
                    }
                    if start_sequence > sequence
                        || self.position.sequence.checked_add(1) != Some(start_sequence)
                    {
                        self.recovery_required = true;
                        return Ok(HostOutput::RecoveryRequired);
                    }
                    self.position.sequence = sequence;
                    return Ok(HostOutput::Output {
                        start: OutputPosition {
                            pty: self.position.pty.clone(),
                            sequence: start_sequence,
                        },
                        end: self.position.clone(),
                        data,
                    });
                }
                BackendOutput::Exited => {
                    return Ok(HostOutput::Exited {
                        pty: self.position.pty.clone(),
                    })
                }
                BackendOutput::RecoveryRequired => {
                    self.recovery_required = true;
                    return Ok(HostOutput::RecoveryRequired);
                }
            }
        }
    }
}

impl<B: HostBackend> InProcessHost<B> {
    pub(super) async fn attach_session(
        &self,
        controller: &Controller,
        pty: &PtyIdentity,
        after: Option<OutputPosition>,
    ) -> Result<HostAttachment, HostError> {
        let state = self.state.lock().await;
        self.validate(&state, controller)?;
        let session = state.session(pty)?;
        if let Some(position) = &after {
            position
                .validate_for(pty)
                .map_err(|_| HostError::StaleOutput)?;
        }
        let attachment = self.backend.attach(session).await?;
        if attachment.snapshot.instance_id != pty.instance.value() {
            return Err(HostError::StalePty);
        }
        let sequence = attachment.snapshot.watermark;
        if after.is_some_and(|position| position.sequence > sequence) {
            return Err(HostError::StaleOutput);
        }
        Ok(HostAttachment {
            snapshot: attachment.snapshot,
            position: OutputPosition {
                pty: pty.clone(),
                sequence,
            },
            output: attachment.output,
            pending: None,
            state: Arc::clone(&self.state),
            controller: controller.clone(),
            recovery_required: false,
        })
    }

    pub(super) async fn ordered_io(
        &self,
        controller: &Controller,
        operation: OperationId,
        request: IoRequest,
    ) -> Result<(), HostError> {
        let mut state = Arc::clone(&self.state).lock_owned().await;
        self.validate(&state, controller)?;
        let bytes = match &request.action {
            IoAction::Write(data) if data.len() > MAX_REQUEST_BYTES => {
                return Err(HostError::InvalidRequest("input too large"))
            }
            IoAction::Write(data) => data.len() + 512,
            IoAction::Resize { columns, rows } => {
                validate_geometry(*columns, *rows)?;
                512
            }
        };
        let mutation = Mutation::Io(request.clone());
        if state.retry(&operation, &mutation)?.is_some() {
            return Ok(());
        }
        let session = state.session(&request.pty)?.clone();
        let previous = state
            .input_sequences
            .get(&request.pty.instance)
            .copied()
            .unwrap_or(0);
        if previous.checked_add(1) != Some(request.sequence) {
            return Err(HostError::OutOfOrder);
        }
        state.begin(operation.clone(), mutation, bytes)?;
        // Reserve the sequence before awaiting, including cancellation/outcome-unknown cases.
        state
            .input_sequences
            .insert(request.pty.instance, request.sequence);
        if let Some(session) = state.sessions.get_mut(&request.pty.instance) {
            session.next_io_sequence = request.sequence.checked_add(1);
        }
        let backend = self.backend.clone();
        tokio::spawn(async move {
            let result = backend.operate(&session, &request.action).await;
            state.finish(&operation, result.clone().map(|()| Receipt::Done));
            result
        })
        .await
        .map_err(|_| HostError::OutcomeUnknown)?
    }
}

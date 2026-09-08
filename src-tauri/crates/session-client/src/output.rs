use crate::Client;
use openforge_session_host::{
    BackendOutput, BackendOutputStream, ControllerFence, HostError, PtyIdentity,
};
use openforge_session_protocol::{Command, Event, Response};
use std::{collections::VecDeque, future::Future, pin::Pin};

pub(crate) struct RemoteFence(pub Client);
impl ControllerFence for RemoteFence {
    fn validate(&self) -> Pin<Box<dyn Future<Output = Result<(), HostError>> + Send + '_>> {
        Box::pin(async {
            self.0
                .host_request(Command::Inventory {
                    controller: self.0.controller().clone(),
                })
                .await
                .map(|_| ())
        })
    }
}

pub(crate) struct RemoteOutput {
    client: Client,
    pty: PtyIdentity,
    cursor: u64,
    queued: VecDeque<BackendOutput>,
}
impl RemoteOutput {
    pub(crate) fn new(client: Client, pty: PtyIdentity, cursor: u64) -> Self {
        Self {
            client,
            pty,
            cursor,
            queued: VecDeque::new(),
        }
    }
}
impl BackendOutputStream for RemoteOutput {
    fn recv(&mut self) -> Pin<Box<dyn Future<Output = BackendOutput> + Send + '_>> {
        Box::pin(async {
            loop {
                if let Some(output) = self.queued.pop_front() {
                    return output;
                }
                let response = self
                    .client
                    .host_request(Command::Events {
                        controller: self.client.controller().clone(),
                        after: self.cursor,
                    })
                    .await;
                let Ok(Response::Events(batch)) = response else {
                    return BackendOutput::RecoveryRequired;
                };
                self.cursor = batch.cursor;
                if batch.gap {
                    return BackendOutput::RecoveryRequired;
                }
                for event in batch.events {
                    let output = match event {
                        Event::Output {
                            pty,
                            sequence,
                            data,
                        } if pty == self.pty => BackendOutput::Output {
                            start_sequence: sequence,
                            sequence,
                            data,
                        },
                        Event::Exited { pty, .. } if pty == self.pty => BackendOutput::Exited,
                        Event::RecoveryRequired { pty } if pty == self.pty => {
                            BackendOutput::RecoveryRequired
                        }
                        _ => continue,
                    };
                    self.queued.push_back(output);
                }
                if self.queued.is_empty() {
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                }
            }
        })
    }
}

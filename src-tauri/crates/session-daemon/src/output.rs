use crate::journal::{lock, SharedJournal};
use openforge_session_host::{BackendOutput, BackendOutputStream, PtyIdentity};
use openforge_session_protocol::Event;
use std::{collections::VecDeque, future::Future, pin::Pin};

pub struct JournalOutput {
    journal: SharedJournal,
    pty: PtyIdentity,
    cursor: u64,
    queued: VecDeque<BackendOutput>,
}
impl JournalOutput {
    pub fn new(journal: SharedJournal, pty: PtyIdentity, cursor: u64) -> Self {
        Self {
            journal,
            pty,
            cursor,
            queued: VecDeque::new(),
        }
    }
}
impl BackendOutputStream for JournalOutput {
    fn recv(&mut self) -> Pin<Box<dyn Future<Output = BackendOutput> + Send + '_>> {
        Box::pin(async {
            loop {
                if let Some(output) = self.queued.pop_front() {
                    return output;
                }
                let batch = lock(&self.journal).events(self.cursor);
                let Ok(batch) = batch else {
                    return BackendOutput::RecoveryRequired;
                };
                self.cursor = batch.cursor;
                if batch.gap {
                    return BackendOutput::RecoveryRequired;
                }
                for event in batch.events {
                    self.queued.push_back(match event {
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
                    });
                }
                if self.queued.is_empty() {
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                }
            }
        })
    }
}

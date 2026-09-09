//! Legacy per-instance writer. Admission never waits for queue capacity; each
//! accepted request has one deadline covering queueing and completion.
//! A timeout cancels unclaimed work. Claimed work may still finish, so neither
//! this writer nor its callers may replay an outcome-unknown request.
//! The single worker preserves ordering even after its caller stops waiting.

use std::io::{self, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const WRITE_QUEUE_CAPACITY: usize = 64;
const WRITE_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Clone, Copy, Debug)]
pub(super) enum PtyWriteSource {
    UserInput,
    GhosttyQueryResponse,
}

impl std::fmt::Display for PtyWriteSource {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UserInput => formatter.write_str("user input"),
            Self::GhosttyQueryResponse => formatter.write_str("Ghostty query response"),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub(super) enum OrderedPtyWriteError {
    #[error("pty writer is disposed; write not executed")]
    Disposed,
    #[error("pty writer scope does not match key {session_key} instance {instance_id}; write not executed")]
    ScopeMismatch {
        session_key: String,
        instance_id: u64,
    },
    #[error("{write_source} write not executed: {reason}")]
    NotExecuted {
        write_source: PtyWriteSource,
        reason: &'static str,
    },
    #[error("{write_source} write outcome unknown: {message}; do not retry")]
    OutcomeUnknown {
        write_source: PtyWriteSource,
        message: String,
    },
}

struct WriteRequest {
    session_key: String,
    instance_id: u64,
    source: PtyWriteSource,
    bytes: Vec<u8>,
    deadline: Instant,
    // The worker claims this flag before I/O; the caller claims it to cancel.
    // Only the winner may execute or promise that execution never occurred.
    pending: Arc<AtomicBool>,
    completion: mpsc::SyncSender<Result<(), OrderedPtyWriteError>>,
}

enum WriterCommand {
    Write(WriteRequest),
    Shutdown,
}

struct OrderedPtyWriterShared {
    session_key: Arc<str>,
    instance_id: u64,
    accepting: AtomicBool,
    tx: mpsc::SyncSender<WriterCommand>,
}

impl OrderedPtyWriterShared {
    fn write(
        &self,
        session_key: &str,
        instance_id: u64,
        source: PtyWriteSource,
        bytes: &[u8],
    ) -> Result<(), OrderedPtyWriteError> {
        if session_key != self.session_key.as_ref() || instance_id != self.instance_id {
            return Err(OrderedPtyWriteError::ScopeMismatch {
                session_key: session_key.to_string(),
                instance_id,
            });
        }
        if !self.accepting.load(Ordering::Acquire) {
            return Err(OrderedPtyWriteError::Disposed);
        }

        let deadline = Instant::now() + WRITE_TIMEOUT;
        let pending = Arc::new(AtomicBool::new(true));
        let (completion, result) = mpsc::sync_channel(1);
        self.tx
            .try_send(WriterCommand::Write(WriteRequest {
                session_key: session_key.to_string(),
                instance_id,
                source,
                bytes: bytes.to_vec(),
                deadline,
                pending: Arc::clone(&pending),
                completion,
            }))
            .map_err(|error| match error {
                mpsc::TrySendError::Full(_) => OrderedPtyWriteError::NotExecuted {
                    write_source: source,
                    reason: "queue is full",
                },
                mpsc::TrySendError::Disconnected(_) => OrderedPtyWriteError::Disposed,
            })?;
        result
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .unwrap_or_else(|error| {
                if pending.swap(false, Ordering::AcqRel) {
                    Err(OrderedPtyWriteError::NotExecuted {
                        write_source: source,
                        reason: match error {
                            mpsc::RecvTimeoutError::Timeout => {
                                "deadline expired before execution; request cancelled"
                            }
                            mpsc::RecvTimeoutError::Disconnected => {
                                "worker disconnected before execution; request cancelled"
                            }
                        },
                    })
                } else {
                    Err(OrderedPtyWriteError::OutcomeUnknown {
                        write_source: source,
                        message: error.to_string(),
                    })
                }
            })
    }
}

pub(super) struct OrderedPtyWriter {
    shared: Arc<OrderedPtyWriterShared>,
    worker: Option<JoinHandle<()>>,
}

impl OrderedPtyWriter {
    pub(super) fn start(
        session_key: String,
        instance_id: u64,
        mut writer: Box<dyn Write + Send>,
    ) -> io::Result<Self> {
        let (tx, rx) = mpsc::sync_channel(WRITE_QUEUE_CAPACITY);
        let shared = Arc::new(OrderedPtyWriterShared {
            session_key: Arc::from(session_key),
            instance_id,
            accepting: AtomicBool::new(true),
            tx,
        });
        let worker_state = Arc::clone(&shared);
        let worker = std::thread::Builder::new()
            .name(format!("pty-writer-{instance_id}"))
            .spawn(move || {
                while let Ok(command) = rx.recv() {
                    // Shutdown may not fit in a full queue. Once the current
                    // I/O returns, discard queued work and release the writer.
                    if !worker_state.accepting.load(Ordering::Acquire) {
                        break;
                    }
                    let WriterCommand::Write(request) = command else {
                        break;
                    };
                    let result = if !worker_state.accepting.load(Ordering::Acquire)
                        || request.session_key != worker_state.session_key.as_ref()
                        || request.instance_id != worker_state.instance_id
                    {
                        Err(OrderedPtyWriteError::Disposed)
                    } else if Instant::now() >= request.deadline
                        || !request.pending.swap(false, Ordering::AcqRel)
                    {
                        Err(OrderedPtyWriteError::NotExecuted {
                            write_source: request.source,
                            reason: "deadline expired before execution",
                        })
                    } else {
                        writer
                            .write_all(&request.bytes)
                            .and_then(|()| writer.flush())
                            .map_err(|error| OrderedPtyWriteError::OutcomeUnknown {
                                write_source: request.source,
                                message: error.to_string(),
                            })
                    };
                    let _ = request.completion.try_send(result);
                }
            })?;
        Ok(Self {
            shared,
            worker: Some(worker),
        })
    }

    pub(super) fn write_user_input(
        &self,
        session_key: &str,
        instance_id: u64,
        bytes: &[u8],
    ) -> Result<(), OrderedPtyWriteError> {
        self.shared
            .write(session_key, instance_id, PtyWriteSource::UserInput, bytes)
    }

    pub(super) fn write_ghostty_query_response(
        &self,
        session_key: &str,
        instance_id: u64,
        bytes: &[u8],
    ) -> Result<(), OrderedPtyWriteError> {
        self.shared.write(
            session_key,
            instance_id,
            PtyWriteSource::GhosttyQueryResponse,
            bytes,
        )
    }
}

impl Drop for OrderedPtyWriter {
    fn drop(&mut self) {
        self.shared.accepting.store(false, Ordering::Release);
        let _ = self.shared.tx.try_send(WriterCommand::Shutdown);
        // A generic Write cannot be interrupted safely. Detach a blocked worker
        // rather than making session teardown wait for the child to read.
        if let Some(worker) = self.worker.take().filter(JoinHandle::is_finished) {
            let _ = worker.join();
        }
    }
}
#[cfg(test)]
#[path = "tests/ordered_writer_deadlines.rs"]
mod deadline_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{self, Write};
    use std::sync::{Arc, Barrier, Mutex};

    struct RecordingWriter {
        bytes: Arc<Mutex<Vec<u8>>>,
    }

    impl Write for RecordingWriter {
        fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
            let Some(byte) = buffer.first() else {
                return Ok(0);
            };
            self.bytes
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .push(*byte);
            std::thread::yield_now();
            Ok(1)
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn user_input_and_ghostty_query_responses_are_serialized_as_distinct_writes() {
        let bytes = Arc::new(Mutex::new(Vec::new()));
        let writer = Arc::new(
            OrderedPtyWriter::start(
                "task-shell-0".to_string(),
                41,
                Box::new(RecordingWriter {
                    bytes: Arc::clone(&bytes),
                }),
            )
            .expect("ordered writer should start"),
        );
        let barrier = Arc::new(Barrier::new(3));

        let user_writer = Arc::clone(&writer);
        let user_barrier = Arc::clone(&barrier);
        let user = std::thread::spawn(move || {
            user_barrier.wait();
            user_writer
                .write_user_input("task-shell-0", 41, b"user")
                .expect("user input should write");
        });
        let response_writer = Arc::clone(&writer);
        let response_barrier = Arc::clone(&barrier);
        let response = std::thread::spawn(move || {
            response_barrier.wait();
            response_writer
                .write_ghostty_query_response("task-shell-0", 41, b"response")
                .expect("Ghostty query response should write");
        });

        barrier.wait();
        user.join().expect("user writer should join");
        response.join().expect("response writer should join");
        let actual = bytes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        assert!(actual == b"userresponse" || actual == b"responseuser");
    }

    #[test]
    fn stale_ghostty_query_response_cannot_write_to_a_successor_instance() {
        let successor_bytes = Arc::new(Mutex::new(Vec::new()));
        let successor_writer = OrderedPtyWriter::start(
            "shared-shell".to_string(),
            11,
            Box::new(RecordingWriter {
                bytes: Arc::clone(&successor_bytes),
            }),
        )
        .expect("successor ordered writer should start");

        assert!(successor_writer
            .write_ghostty_query_response("shared-shell", 10, b"stale")
            .is_err());
        successor_writer
            .write_ghostty_query_response("shared-shell", 11, b"current")
            .expect("current query response should write");

        assert_eq!(
            successor_bytes
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .as_slice(),
            b"current"
        );
    }
}

use super::*;
use std::sync::Mutex;
use std::time::Duration;

const TEST_WAIT: Duration = Duration::from_secs(3);

/// Models a child that stops reading until the test releases it. Dropping the
/// control also releases it, so failed assertions cannot strand the worker.
struct StalledPty {
    release: mpsc::Sender<()>,
    entered: mpsc::Receiver<()>,
    bytes: Arc<Mutex<Vec<u8>>>,
    stopped: mpsc::Receiver<()>,
}

#[derive(Clone, Copy)]
enum StallPoint {
    Write,
    Flush,
}

struct StalledWriter {
    release: Option<mpsc::Receiver<()>>,
    entered: mpsc::Sender<()>,
    bytes: Arc<Mutex<Vec<u8>>>,
    stopped: mpsc::Sender<()>,
    stall_point: StallPoint,
}

impl StalledPty {
    fn start() -> (OrderedPtyWriter, Self) {
        Self::start_at(StallPoint::Write)
    }

    fn start_at(stall_point: StallPoint) -> (OrderedPtyWriter, Self) {
        let (release, wait) = mpsc::channel();
        let (entered, started) = mpsc::channel();
        let (stopped, stop) = mpsc::channel();
        let bytes = Arc::new(Mutex::new(Vec::new()));
        let writer = OrderedPtyWriter::start(
            "shell".into(),
            1,
            Box::new(StalledWriter {
                release: Some(wait),
                entered,
                bytes: Arc::clone(&bytes),
                stopped,
                stall_point,
            }),
        )
        .unwrap();
        (
            writer,
            Self {
                release,
                entered: started,
                bytes,
                stopped: stop,
            },
        )
    }
}

impl Drop for StalledPty {
    fn drop(&mut self) {
        let _ = self.release.send(());
    }
}

impl Drop for StalledWriter {
    fn drop(&mut self) {
        let _ = self.stopped.send(());
    }
}

impl StalledWriter {
    fn wait_for_child(&mut self) {
        if let Some(release) = self.release.take() {
            self.entered.send(()).unwrap();
            let _ = release.recv();
        }
    }
}

impl Write for StalledWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if matches!(self.stall_point, StallPoint::Write) {
            self.wait_for_child();
        }
        self.bytes.lock().unwrap().extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        if matches!(self.stall_point, StallPoint::Flush) {
            self.wait_for_child();
        }
        Ok(())
    }
}

#[test]
fn stalled_input_and_replies_return_unknown_without_replay_or_overtaking() {
    for (source, stall_point) in [
        (PtyWriteSource::UserInput, StallPoint::Write),
        (PtyWriteSource::GhosttyQueryResponse, StallPoint::Write),
        (PtyWriteSource::UserInput, StallPoint::Flush),
        (PtyWriteSource::GhosttyQueryResponse, StallPoint::Flush),
    ] {
        let (writer, pty) = StalledPty::start_at(stall_point);
        let writer = Arc::new(writer);
        let caller = Arc::clone(&writer);
        let (done, result) = mpsc::channel();
        let call = std::thread::spawn(move || {
            let outcome = match source {
                PtyWriteSource::UserInput => caller.write_user_input("shell", 1, b"first"),
                PtyWriteSource::GhosttyQueryResponse => {
                    caller.write_ghostty_query_response("shell", 1, b"first")
                }
            };
            done.send(outcome).unwrap();
        });
        pty.entered.recv_timeout(TEST_WAIT).unwrap();
        let outcome = result.recv_timeout(TEST_WAIT);
        // Always release before asserting, including against the old blocking code.
        pty.release.send(()).unwrap();
        call.join().unwrap();
        let error = outcome
            .expect("stalled write must return before the PTY resumes")
            .expect_err("an in-flight timeout cannot claim success");
        assert!(
            matches!(error, OrderedPtyWriteError::OutcomeUnknown { .. }),
            "{error}"
        );
        assert!(error.to_string().contains("do not retry"), "{error}");

        writer
            .write_ghostty_query_response("shell", 1, b"next")
            .unwrap();
        assert_eq!(pty.bytes.lock().unwrap().as_slice(), b"firstnext");
    }
}

#[test]
fn expired_queued_reply_is_not_executed_when_the_pty_resumes() {
    let (writer, pty) = StalledPty::start();
    let writer = Arc::new(writer);
    let caller = Arc::clone(&writer);
    let first = std::thread::spawn(move || caller.write_user_input("shell", 1, b"first"));
    pty.entered.recv_timeout(TEST_WAIT).unwrap();

    let responder = Arc::clone(&writer);
    let (done, result) = mpsc::channel();
    let reply = std::thread::spawn(move || {
        done.send(responder.write_ghostty_query_response("shell", 1, b"expired"))
            .unwrap();
    });
    let outcome = result.recv_timeout(TEST_WAIT);
    pty.release.send(()).unwrap();
    let _ = first.join().unwrap();
    reply.join().unwrap();
    let error = outcome
        .expect("queued reply must return before the PTY resumes")
        .expect_err("queued reply must time out");
    writer.write_user_input("shell", 1, b"last").unwrap();

    assert!(error.to_string().contains("not executed"), "{error}");
    assert_eq!(pty.bytes.lock().unwrap().as_slice(), b"firstlast");
}

#[test]
fn saturated_queue_rejects_and_disposes_without_waiting_for_the_stalled_pty() {
    let (writer, pty) = StalledPty::start();
    let writer = Arc::new(writer);
    let caller = Arc::clone(&writer);
    let first = std::thread::spawn(move || caller.write_user_input("shell", 1, b"first"));
    pty.entered.recv_timeout(TEST_WAIT).unwrap();

    let (done, results) = mpsc::channel();
    let calls: Vec<_> = (0..=WRITE_QUEUE_CAPACITY)
        .map(|index| {
            let caller = Arc::clone(&writer);
            let done = done.clone();
            std::thread::spawn(move || {
                let result = if index % 2 == 0 {
                    caller.write_user_input("shell", 1, b"queued-input")
                } else {
                    caller.write_ghostty_query_response("shell", 1, b"queued-reply")
                };
                done.send(result).unwrap();
            })
        })
        .collect();
    drop(done);
    let deadline = Instant::now() + TEST_WAIT;
    let outcomes: Vec<_> = (0..calls.len())
        .map(|_| results.recv_timeout(deadline.saturating_duration_since(Instant::now())))
        .collect();
    // Unblock old/broken implementations before joining their callers.
    if outcomes.iter().any(Result::is_err) {
        let _ = pty.release.send(());
    }
    let _ = first.join().unwrap();
    for call in calls {
        call.join().unwrap();
    }

    let (done, disposed) = mpsc::channel();
    let dropper = std::thread::spawn(move || {
        drop(writer);
        done.send(()).unwrap();
    });
    let disposal = disposed.recv_timeout(TEST_WAIT);
    let _ = pty.release.send(());
    dropper.join().unwrap();
    pty.stopped.recv_timeout(TEST_WAIT).unwrap();
    disposal.expect("disposal must not wait for space in the full queue");

    let errors: Vec<_> = outcomes
        .into_iter()
        .map(|outcome| {
            outcome
                .expect("even a full queue must return before the PTY resumes")
                .expect_err("no queued write can complete while the PTY is stalled")
        })
        .collect();
    assert!(errors
        .iter()
        .all(|error| matches!(error, OrderedPtyWriteError::NotExecuted { .. })));
    assert!(errors
        .iter()
        .any(|error| error.to_string().contains("queue is full")));
    assert_eq!(pty.bytes.lock().unwrap().as_slice(), b"first");
}

#[test]
fn disposing_a_stalled_writer_returns_before_the_pty_resumes() {
    let (writer, pty) = StalledPty::start();
    let writer = Arc::new(writer);
    let caller = Arc::clone(&writer);
    let (done, result) = mpsc::channel();
    let first = std::thread::spawn(move || {
        done.send(caller.write_user_input("shell", 1, b"first"))
            .unwrap();
    });
    pty.entered.recv_timeout(TEST_WAIT).unwrap();
    let outcome = result.recv_timeout(TEST_WAIT);
    if outcome.is_err() {
        let _ = pty.release.send(());
    }
    first.join().unwrap();
    assert!(matches!(
        outcome.expect("stalled input must return before the PTY resumes"),
        Err(OrderedPtyWriteError::OutcomeUnknown { .. })
    ));

    let (done, disposed) = mpsc::channel();
    let dropper = std::thread::spawn(move || {
        drop(writer);
        done.send(()).unwrap();
    });
    let outcome = disposed.recv_timeout(TEST_WAIT);
    pty.release.send(()).unwrap();
    dropper.join().unwrap();
    pty.stopped.recv_timeout(TEST_WAIT).unwrap();

    outcome.expect("disposal must not wait for a blocked PTY write");
    assert_eq!(pty.bytes.lock().unwrap().as_slice(), b"first");
}

enum Failure {
    Write,
    Flush,
}

struct FailingWriter {
    failure: Failure,
    bytes: Arc<Mutex<Vec<u8>>>,
}

impl Write for FailingWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let mut recorded = self.bytes.lock().unwrap();
        if matches!(self.failure, Failure::Write) && !recorded.is_empty() {
            return Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "child stopped reading",
            ));
        }
        recorded.push(bytes[0]);
        Ok(1)
    }

    fn flush(&mut self) -> io::Result<()> {
        if matches!(self.failure, Failure::Flush) {
            return Err(io::Error::new(io::ErrorKind::BrokenPipe, "flush failed"));
        }
        Ok(())
    }
}

#[test]
fn partial_write_and_flush_failures_are_unknown_not_safe_to_replay() {
    for (failure, expected, message) in [
        (Failure::Write, b"f".as_slice(), "child stopped reading"),
        (Failure::Flush, b"first".as_slice(), "flush failed"),
    ] {
        let bytes = Arc::new(Mutex::new(Vec::new()));
        let writer = OrderedPtyWriter::start(
            "shell".into(),
            1,
            Box::new(FailingWriter {
                failure,
                bytes: Arc::clone(&bytes),
            }),
        )
        .unwrap();
        let error = writer.write_user_input("shell", 1, b"first").unwrap_err();
        assert!(
            matches!(error, OrderedPtyWriteError::OutcomeUnknown { .. }),
            "{error}"
        );
        assert!(error.to_string().contains(message), "{error}");
        assert!(error.to_string().contains("do not retry"), "{error}");
        assert_eq!(bytes.lock().unwrap().as_slice(), expected);
    }
}

struct PanickingWriter;

impl Write for PanickingWriter {
    fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
        panic!("worker lost during I/O");
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn lost_completion_is_unknown_but_submission_to_a_dead_worker_is_not_executed() {
    let writer = OrderedPtyWriter::start("shell".into(), 1, Box::new(PanickingWriter)).unwrap();
    let error = writer.write_user_input("shell", 1, b"first").unwrap_err();
    assert!(
        matches!(error, OrderedPtyWriteError::OutcomeUnknown { .. }),
        "{error}"
    );
    // Submission can race queue teardown, but no successor request may execute.
    let error = writer.write_user_input("shell", 1, b"second").unwrap_err();
    assert!(
        matches!(
            error,
            OrderedPtyWriteError::Disposed | OrderedPtyWriteError::NotExecuted { .. }
        ),
        "{error}"
    );
    assert!(error.to_string().contains("not executed"), "{error}");
}

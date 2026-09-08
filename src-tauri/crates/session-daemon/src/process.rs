use crate::journal::{lock, SharedJournal};
use crate::managed_process::{
    terminate_managed_process_tree_with_root_reaper, ManagedProcessIdentity, RootReapMode,
};
use crate::terminal_model::{TerminalModelEvent, TerminalModelOptions, TerminalModelSession};
use openforge_session_protocol::*;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

pub struct Process {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    identity: ManagedProcessIdentity,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    model: Arc<TerminalModelSession>,
    stopping: Arc<AtomicBool>,
    reader_done: Arc<AtomicBool>,
    pty: PtyIdentity,
    root_exit: Option<(u32, Instant)>,
}

impl Process {
    pub fn spawn(
        command: &ShellCommand,
        pty: PtyIdentity,
        journal: SharedJournal,
    ) -> Result<Self, Error> {
        let pair = native_pty_system()
            .openpty(size(command.columns, command.rows))
            .map_err(host_error)?;
        let fd = pair
            .master
            .as_raw_fd()
            .ok_or_else(|| Error::Host("PTY descriptor unavailable".into()))?;
        // SAFETY: fd is owned by pair.master; fcntl changes flags, not ownership.
        let flags = unsafe { libc::fcntl(fd, libc::F_GETFL) };
        // SAFETY: fd remains live and the nonblocking flag is valid for a PTY.
        if flags < 0 || unsafe { libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
            return Err(host_error(std::io::Error::last_os_error()));
        }
        let mut reader = pair.master.try_clone_reader().map_err(host_error)?;
        let writer = Arc::new(Mutex::new(pair.master.take_writer().map_err(host_error)?));
        let event_writer = Arc::clone(&writer);
        let event_pty = pty.clone();
        let mut options = TerminalModelOptions::new(command.columns, command.rows);
        options.max_scrollback_bytes = 256 * 1024;
        let (model, feeder) = TerminalModelSession::start_with_event_sink(
            command.owner.session_key(),
            pty.instance.value(),
            options,
            Arc::new(move |event| match event {
                TerminalModelEvent::Output(frame) => lock(&journal).publish(Event::Output {
                    pty: event_pty.clone(),
                    sequence: frame.sequence,
                    data: frame.bytes,
                }),
                TerminalModelEvent::ProtocolReply { bytes, .. } => {
                    if write_bounded(&event_writer, &bytes).is_err() {
                        lock(&journal).publish(Event::RecoveryRequired {
                            pty: event_pty.clone(),
                        });
                    }
                }
                TerminalModelEvent::Disabled { .. } => {
                    lock(&journal).publish(Event::RecoveryRequired {
                        pty: event_pty.clone(),
                    })
                }
            }),
        )
        .map_err(host_error)?;
        let model = Arc::new(model);
        let mut builder = CommandBuilder::new(&command.command.program);
        builder.args(&command.command.args);
        builder.cwd(&command.command.cwd);
        builder.env_clear();
        builder.env("TERM", "xterm-256color");
        builder.env("TERM_PROGRAM", "OpenForge");
        for (key, value) in &command.command.env {
            builder.env(key, value);
        }
        let mut child = pair.slave.spawn_command(builder).map_err(host_error)?;
        drop(pair.slave);
        let pid = child
            .process_id()
            .ok_or_else(|| Error::Host("child has no PID".into()))?;
        let identity = match ManagedProcessIdentity::capture(pid) {
            Ok(identity) => identity,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::Host(error));
            }
        };
        let process = Self {
            master: pair.master,
            child,
            identity,
            writer,
            model,
            stopping: Arc::new(AtomicBool::new(false)),
            reader_done: Arc::new(AtomicBool::new(false)),
            pty,
            root_exit: None,
        };
        let stopping = Arc::clone(&process.stopping);
        let reader_done = Arc::clone(&process.reader_done);
        let barrier = Arc::clone(&process.model);
        std::thread::Builder::new()
            .name(format!("session-read-{pid}"))
            .spawn(move || {
                let mut buffer = [0; 8192];
                while !stopping.load(Ordering::Acquire) {
                    match reader.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(size) => feeder.feed(&buffer[..size]),
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            std::thread::sleep(Duration::from_millis(5))
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {}
                        Err(_) => break,
                    }
                }
                // Cross the authority queue before publishing the final process exit.
                let _ = barrier.portable_snapshot();
                reader_done.store(true, Ordering::Release);
            })
            .map_err(host_error)?;
        Ok(process)
    }

    pub fn pid(&self) -> u32 {
        self.identity.root_pid as u32
    }

    pub fn poll_exit(&mut self) -> Result<Option<u32>, Error> {
        // Root liveness is independent of a descendant-held slave or reader progress.
        if self.root_exit.is_none() {
            if let Some(status) = self.child.try_wait().map_err(host_error)? {
                self.root_exit = Some((status.exit_code(), Instant::now()));
            }
        }
        Ok(self.root_exit.map(|(code, _)| code))
    }

    pub fn output_drained(&self) -> bool {
        if self
            .root_exit
            .is_some_and(|(_, observed)| observed.elapsed() >= Duration::from_millis(250))
        {
            self.stopping.store(true, Ordering::Release);
        }
        // The reader crosses the bounded authority barrier before setting this flag.
        self.reader_done.load(Ordering::Acquire)
    }

    pub fn operate(&self, action: &IoAction) -> Result<(), Error> {
        match action {
            IoAction::Write(bytes) => write_bounded(&self.writer, bytes),
            IoAction::Resize { columns, rows } => {
                self.master
                    .resize(size(*columns, *rows))
                    .map_err(host_error)?;
                self.model.resize(*columns, *rows);
                self.model
                    .portable_snapshot()
                    .map_err(|_| Error::OutcomeUnknown)?;
                Ok(())
            }
        }
    }

    pub fn recover(&self, cursor: u64) -> Result<Recovery, Error> {
        let snapshot = self
            .model
            .portable_snapshot()
            .map_err(|_| Error::RecoveryUnavailable)?;
        if snapshot.portable_vt.len()
            + snapshot.compatibility_replay.len()
            + snapshot.continuation.len()
            > 768 * 1024
        {
            return Err(Error::Capacity);
        }
        Ok(Recovery {
            pty: self.pty.clone(),
            watermark: snapshot.watermark,
            cursor,
            portable_vt: snapshot.portable_vt,
            compatibility_replay: snapshot.compatibility_replay,
            continuation: snapshot.continuation,
        })
    }

    pub fn terminate(&mut self) -> Result<(), Error> {
        std::thread::scope(|scope| scope.spawn(|| self.terminate_off_executor()).join())
            .map_err(|_| Error::OutcomeUnknown)?
    }

    fn terminate_off_executor(&mut self) -> Result<(), Error> {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .map_err(host_error)?;
        runtime
            .block_on(terminate_managed_process_tree_with_root_reaper(
                &self.identity,
                Duration::from_millis(200),
                |mode| match mode {
                    RootReapMode::Poll => {
                        let _ = self.child.try_wait();
                    }
                    RootReapMode::Wait => {
                        let _ = self.child.wait();
                    }
                },
            ))
            .map_err(Error::Host)?;
        Ok(())
    }
}

impl Drop for Process {
    fn drop(&mut self) {
        // Used only for explicit scoped cleanup, failed spawn, or an already exited root.
        if let Err(error) = self.terminate() {
            eprintln!("session cleanup failed: {error}");
        }
        self.stopping.store(true, Ordering::Release);
    }
}

fn size(columns: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols: columns,
        pixel_width: 0,
        pixel_height: 0,
    }
}
fn host_error(error: impl std::fmt::Display) -> Error {
    Error::Host(error.to_string())
}

fn write_bounded(writer: &Arc<Mutex<Box<dyn Write + Send>>>, bytes: &[u8]) -> Result<(), Error> {
    let mut writer = writer.lock().map_err(|_| Error::OutcomeUnknown)?;
    let deadline = Instant::now() + Duration::from_millis(250);
    let mut remaining = bytes;
    while !remaining.is_empty() {
        match writer.write(remaining) {
            Ok(0) => return Err(Error::OutcomeUnknown),
            Ok(written) => remaining = &remaining[written..],
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::Interrupted
                ) && Instant::now() < deadline =>
            {
                std::thread::sleep(Duration::from_millis(2))
            }
            Err(_) => return Err(Error::OutcomeUnknown),
        }
        if Instant::now() >= deadline && !remaining.is_empty() {
            return Err(Error::OutcomeUnknown);
        }
    }
    Ok(())
}

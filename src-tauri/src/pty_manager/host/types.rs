use std::collections::BTreeMap;
use std::path::PathBuf;

use super::*;
use crate::pty_manager::TerminalImageProtocol;

pub(crate) const MAX_REQUEST_BYTES: usize = 64 * 1024;
pub(crate) const MAX_OPERATIONS: usize = 1024;
pub(crate) const MAX_RETAINED_REQUEST_BYTES: usize = 4 * 1024 * 1024;
pub(crate) const MAX_SESSIONS: usize = 1024;
pub(crate) const MAX_EXIT_HISTORY: usize = 1024;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub(crate) enum HostError {
    #[error("invalid host request: {0}")]
    InvalidRequest(&'static str),
    #[error(transparent)]
    InvalidIdentity(#[from] IdentityError),
    #[error("foreign installation")]
    ForeignInstallation,
    #[error("stale controller")]
    StaleController,
    #[error("stale PTY identity")]
    StalePty,
    #[error("stale output position")]
    StaleOutput,
    #[error("operation identity reused with a different request")]
    OperationConflict,
    #[error("operation outcome unknown; reconcile before issuing another operation")]
    OutcomeUnknown,
    #[error("host retention capacity exhausted; request not executed")]
    Capacity,
    #[error("input sequence is out of order")]
    OutOfOrder,
    #[error("live executable replacement is unsupported by this host")]
    UnsupportedReplacement,
    #[error("terminal recovery is unavailable")]
    RecoveryUnavailable,
    #[error("terminal host: {0}")]
    Backend(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum TerminalOwner {
    Agent { task_id: String },
    Shell { task_id: String, index: Option<u32> },
}

impl TerminalOwner {
    pub(crate) fn task_id(&self) -> &str {
        match self {
            Self::Agent { task_id } | Self::Shell { task_id, .. } => task_id,
        }
    }

    pub(crate) fn session_key(&self) -> String {
        match self {
            Self::Agent { task_id } => task_id.clone(),
            Self::Shell { task_id, index } => {
                crate::pty_manager::shell_session_key(task_id, *index)
            }
        }
    }
}

/// Provider preparation has already finished. No hook installation or domain operations
/// are allowed here. The existing adapter still supplies its normal terminal environment.
#[derive(Clone, PartialEq, Eq)]
pub(crate) struct PreparedCommand {
    pub(crate) program: String,
    pub(crate) args: Vec<String>,
    pub(crate) env: BTreeMap<String, String>,
    pub(crate) cwd: PathBuf,
}

impl std::fmt::Debug for PreparedCommand {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Arguments and environment can contain prompts, credentials and user data.
        f.debug_struct("PreparedCommand").finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SpawnRequest {
    pub(crate) owner: TerminalOwner,
    pub(crate) command: PreparedCommand,
    pub(crate) columns: u16,
    pub(crate) rows: u16,
    pub(crate) image_protocol: Option<TerminalImageProtocol>,
}

impl SpawnRequest {
    pub(crate) fn validate(&self) -> Result<usize, HostError> {
        InstallationId::parse(self.owner.task_id())?;
        let command = &self.command;
        if command.program.is_empty() || command.program.contains('\0') {
            return Err(HostError::InvalidRequest("invalid program"));
        }
        if !command.cwd.is_absolute() || command.cwd.as_os_str().as_encoded_bytes().contains(&0) {
            return Err(HostError::InvalidRequest(
                "cwd must be an absolute path without NUL",
            ));
        }
        if command.args.iter().any(|arg| arg.contains('\0'))
            || command.env.iter().any(|(key, value)| {
                key.is_empty() || key.contains(['=', '\0']) || value.contains('\0')
            })
        {
            return Err(HostError::InvalidRequest("invalid argument or environment"));
        }
        validate_geometry(self.columns, self.rows)?;
        // Include separators so many empty arguments cannot bypass the retention budget.
        let size = command.program.len()
            + command.cwd.as_os_str().len()
            + self.owner.task_id().len()
            + command.args.iter().map(|arg| arg.len() + 1).sum::<usize>()
            + command
                .env
                .iter()
                .map(|(key, value)| key.len() + value.len() + 2)
                .sum::<usize>()
            + 32;
        if size > MAX_REQUEST_BYTES {
            return Err(HostError::InvalidRequest("spawn request too large"));
        }
        Ok(size)
    }
}

pub(crate) fn validate_geometry(columns: u16, rows: u16) -> Result<(), HostError> {
    if columns == 0 || rows == 0 {
        return Err(HostError::InvalidRequest("zero terminal geometry"));
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Controller {
    pub(crate) installation: InstallationId,
    pub(crate) lifetime: DaemonLifetimeId,
    pub(crate) generation: ControllerGeneration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum HostedSessionState {
    Live,
    Cleaning,
    ManagedRecovery,
    Exited,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HostedSession {
    pub(crate) pty: PtyIdentity,
    pub(crate) session_key: String,
    pub(crate) state: HostedSessionState,
    /// Next write/resize sequence, recoverable without the previous controller's state.
    /// None means the numeric sequence space is exhausted.
    pub(crate) next_io_sequence: Option<u64>,
}

#[derive(Debug)]
pub(crate) struct Connection {
    pub(crate) controller: Controller,
    pub(crate) inventory: Vec<HostedSession>,
    pub(crate) supports_replacement: bool,
}

#[derive(Clone, PartialEq, Eq)]
pub(crate) enum IoAction {
    Write(Vec<u8>),
    Resize { columns: u16, rows: u16 },
}

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct IoRequest {
    pub(crate) pty: PtyIdentity,
    /// Starts at one and continues across controller handoff for this PTY.
    pub(crate) sequence: u64,
    pub(crate) action: IoAction,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum ReplacementPhase {
    Prepare,
    Commit,
    Abort,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum HostOutput {
    Output {
        start: OutputPosition,
        end: OutputPosition,
        data: Vec<u8>,
    },
    Exited {
        pty: PtyIdentity,
    },
    RecoveryRequired,
}

use std::num::NonZeroU64;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("invalid host identity: {0}")]
pub(crate) struct IdentityError(&'static str);

macro_rules! text_identity {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, Hash)]
        pub(crate) struct $name(String);

        impl $name {
            pub(crate) fn parse(value: impl Into<String>) -> Result<Self, IdentityError> {
                let value = value.into();
                if value.is_empty()
                    || value.len() > 128
                    || !value.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.')
                    })
                {
                    return Err(IdentityError("expected 1..128 ASCII identifier characters"));
                }
                Ok(Self(value))
            }
        }
    };
}

// Installation is stable for one app-data namespace. It is not a PID or executable version.
text_identity!(InstallationId);
// A new owner process lifetime gets a new identity, even when the OS reuses its PID.
// A future compatible reexec must retain this identity. This slice never performs reexec.
text_identity!(DaemonLifetimeId);
impl DaemonLifetimeId {
    pub(super) fn fresh() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}
// A retry retains its operation identity, including across controller reconnection.
text_identity!(OperationId);

macro_rules! numeric_identity {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub(crate) struct $name(NonZeroU64);

        impl $name {
            pub(crate) fn new(value: u64) -> Result<Self, IdentityError> {
                NonZeroU64::new(value)
                    .map(Self)
                    .ok_or(IdentityError("zero is reserved"))
            }

            pub(crate) fn value(self) -> u64 {
                self.0.get()
            }
        }
    };
}

// Controller handoff changes the generation, not the identity of surviving PTYs.
numeric_identity!(ControllerGeneration);
// Existing instance_id allocations remain unchanged at the renderer/plugin boundary.
numeric_identity!(PtyInstanceId);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct PtyIdentity {
    pub(crate) installation: InstallationId,
    pub(crate) lifetime: DaemonLifetimeId,
    pub(crate) instance: PtyInstanceId,
}

/// A terminal authority watermark, not a byte offset, PID, or controller generation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OutputPosition {
    pub(crate) pty: PtyIdentity,
    pub(crate) sequence: u64,
}

impl OutputPosition {
    pub(crate) fn validate_for(&self, pty: &PtyIdentity) -> Result<(), IdentityError> {
        if &self.pty != pty {
            return Err(IdentityError("output belongs to a different PTY"));
        }
        Ok(())
    }
}

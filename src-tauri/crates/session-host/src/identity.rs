use serde::{Deserialize, Serialize};
use std::num::NonZeroU64;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("invalid host identity: {0}")]
pub struct IdentityError(&'static str);

macro_rules! text_identity {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(try_from = "String", into = "String")]
        pub struct $name(String);
        impl $name {
            pub fn parse(value: impl Into<String>) -> Result<Self, IdentityError> {
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
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }
        impl TryFrom<String> for $name {
            type Error = IdentityError;
            fn try_from(value: String) -> Result<Self, Self::Error> {
                Self::parse(value)
            }
        }
        impl From<$name> for String {
            fn from(value: $name) -> Self {
                value.0
            }
        }
    };
}
text_identity!(InstallationId);
text_identity!(DaemonLifetimeId);
text_identity!(OperationId);
impl DaemonLifetimeId {
    pub(super) fn fresh() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

macro_rules! numeric_identity {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(try_from = "u64", into = "u64")]
        pub struct $name(NonZeroU64);
        impl $name {
            pub fn new(value: u64) -> Result<Self, IdentityError> {
                NonZeroU64::new(value)
                    .map(Self)
                    .ok_or(IdentityError("zero is reserved"))
            }
            pub fn value(self) -> u64 {
                self.0.get()
            }
        }
        impl TryFrom<u64> for $name {
            type Error = IdentityError;
            fn try_from(value: u64) -> Result<Self, Self::Error> {
                Self::new(value)
            }
        }
        impl From<$name> for u64 {
            fn from(value: $name) -> u64 {
                value.value()
            }
        }
        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.value().fmt(f)
            }
        }
    };
}
numeric_identity!(ControllerGeneration);
numeric_identity!(PtyInstanceId);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PtyIdentity {
    pub installation: InstallationId,
    pub lifetime: DaemonLifetimeId,
    pub instance: PtyInstanceId,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutputPosition {
    pub pty: PtyIdentity,
    pub sequence: u64,
}
impl OutputPosition {
    pub fn validate_for(&self, pty: &PtyIdentity) -> Result<(), IdentityError> {
        if &self.pty != pty {
            return Err(IdentityError("output belongs to a different PTY"));
        }
        Ok(())
    }
}

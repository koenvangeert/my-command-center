//! Agent transport configuration. Domain handlers remain in the Sidecar.
use crate::Error;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SidecarEndpoint {
    pub port: u16,
    pub token: String,
}
impl std::fmt::Debug for SidecarEndpoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SidecarEndpoint")
            .field("port", &self.port)
            .finish_non_exhaustive()
    }
}
impl SidecarEndpoint {
    /// # Errors
    /// Rejects unusable loopback ports and invalid authorization header values.
    pub fn validate(&self) -> Result<(), Error> {
        if self.port == 0
            || self.token.is_empty()
            || self.token.len() > 256
            || !self
                .token
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        {
            return Err(Error::InvalidRequest);
        }
        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AgentConfig {
    pub version: u32,
    pub port: u16,
    pub token: String,
    pub pty: crate::PtyIdentity,
    pub owner: crate::TerminalOwner,
}
impl std::fmt::Debug for AgentConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AgentConfig")
            .field("pty", &self.pty)
            .finish_non_exhaustive()
    }
}

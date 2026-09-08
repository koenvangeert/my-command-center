use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalViewSnapshot {
    pub instance_id: u64,
    pub watermark: u64,
    pub data: String,
    pub compatibility_data: String,
    pub continuation_data: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TerminalImageProtocol {
    Iterm2,
}

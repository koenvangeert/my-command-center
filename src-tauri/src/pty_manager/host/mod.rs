//! Shared host policy; legacy renderer/plugin callers remain outside its control ledger.
pub(crate) use openforge_session_host::*;

#[cfg(test)]
mod cancellation_tests;
#[cfg(test)]
mod contract_tests;
#[cfg(test)]
mod deterministic;
#[cfg(test)]
mod failure_tests;
#[cfg(test)]
mod identity_tests;
#[cfg(test)]
mod lifecycle_tests;
#[cfg(test)]
mod output_tests;

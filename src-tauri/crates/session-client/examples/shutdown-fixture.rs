//! Explicit teardown for the isolated controlled-restart desktop fixture.
use std::time::{Duration, Instant};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::path::PathBuf::from(
        std::env::args_os()
            .nth(1)
            .ok_or("fixture root is required")?,
    );
    if !root
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("openforge-restart-daemon-"))
    {
        return Err("refusing to shut down a non-fixture daemon".into());
    }
    let client = openforge_session_client::Client::connect(&root)?;
    for session in client.inventory()?.sessions {
        client.terminate(
            &format!("fixture-cleanup-{}", session.pty.instance),
            &session.pty,
        )?;
    }
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match client.shutdown_empty() {
            Ok(()) => return Ok(()),
            Err(error) if Instant::now() >= deadline => return Err(error.into()),
            Err(_) => std::thread::sleep(Duration::from_millis(20)),
        }
    }
}

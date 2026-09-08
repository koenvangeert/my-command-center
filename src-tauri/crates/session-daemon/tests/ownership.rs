use openforge_session_client::Client;
use openforge_session_protocol::Error;
use std::os::unix::fs::PermissionsExt;

#[test]
fn detached_singleton_fences_old_controllers_and_refuses_foreign_discovery() {
    let root = tempfile::Builder::new()
        .prefix("of-session-")
        .tempdir_in("/tmp")
        .unwrap();
    let executable = std::path::Path::new(env!("CARGO_BIN_EXE_openforge-session-daemon"));
    let first = Client::launch(executable, root.path()).unwrap();
    let second = Client::launch(executable, root.path()).unwrap();
    assert_eq!(first.controller().lifetime, second.controller().lifetime);
    assert!(matches!(first.inventory(), Err(Error::StaleController)));
    let mut foreign = second.controller().clone();
    foreign.installation =
        openforge_session_host::InstallationId::parse("foreign-installation").unwrap();
    let imposter = second.with_controller(foreign);
    assert!(matches!(
        imposter.inventory(),
        Err(Error::ForeignInstallation)
    ));
    assert!(second.inventory().unwrap().sessions.is_empty());
    second.shutdown_empty().unwrap();
    let metadata = std::fs::metadata(root.path().join("session-v1/credentials.json")).unwrap();
    assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
}

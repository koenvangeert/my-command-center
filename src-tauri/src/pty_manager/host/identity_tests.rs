use super::*;

#[test]
fn identities_reject_invalid_values_before_entering_the_host() {
    for invalid in ["", " ", "a/b", "a\0b", "a\nb"] {
        assert!(InstallationId::parse(invalid).is_err());
        assert!(DaemonLifetimeId::parse(invalid).is_err());
        assert!(OperationId::parse(invalid).is_err());
    }
    assert!(InstallationId::parse("x".repeat(129)).is_err());
    assert!(ControllerGeneration::new(0).is_err());
    assert!(PtyInstanceId::new(0).is_err());
    assert!(InstallationId::parse("installation-1").is_ok());
    assert!(DaemonLifetimeId::parse("lifetime-1").is_ok());
    assert!(OperationId::parse("spawn-1").is_ok());
}

#[test]
fn output_positions_cannot_cross_installations_lifetimes_or_pty_allocations() {
    let pty = PtyIdentity {
        installation: InstallationId::parse("installation-1").unwrap(),
        lifetime: DaemonLifetimeId::parse("lifetime-1").unwrap(),
        instance: PtyInstanceId::new(1).unwrap(),
    };
    let position = OutputPosition {
        pty: pty.clone(),
        sequence: 0,
    };
    assert!(position.validate_for(&pty).is_ok());
    let mut foreign = pty.clone();
    foreign.installation = InstallationId::parse("installation-2").unwrap();
    assert!(position.validate_for(&foreign).is_err());
    foreign = pty.clone();
    foreign.lifetime = DaemonLifetimeId::parse("lifetime-2").unwrap();
    assert!(position.validate_for(&foreign).is_err());
    foreign = pty;
    foreign.instance = PtyInstanceId::new(2).unwrap();
    assert!(position.validate_for(&foreign).is_err());
}

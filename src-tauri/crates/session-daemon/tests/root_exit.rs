use openforge_session_client::Client;
use openforge_session_host::{PreparedCommand, SpawnRequest, TerminalOwner};
use std::time::{Duration, Instant};

struct Fixture {
    root: tempfile::TempDir,
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if let Ok(client) = Client::connect(self.root.path()) {
            for session in client.inventory().unwrap().sessions {
                client
                    .terminate(&format!("cleanup-{}", session.pty.instance), &session.pty)
                    .unwrap();
            }
            let deadline = Instant::now() + Duration::from_secs(5);
            while client.shutdown_empty().is_err() {
                assert!(Instant::now() < deadline, "fixture daemon did not stop");
                std::thread::sleep(Duration::from_millis(20));
            }
        }
    }
}

#[test]
#[cfg_attr(
    target_os = "macos",
    ignore = "macOS revokes the descendant slave; the no-EOF fixture requires Linux"
)]
fn root_exit_is_observed_without_slave_eof() {
    let fixture = Fixture {
        root: tempfile::Builder::new()
            .prefix("of-root-exit-")
            .tempdir_in("/tmp")
            .unwrap(),
    };
    let client = Client::launch(
        std::path::Path::new(env!("CARGO_BIN_EXE_openforge-session-daemon")),
        fixture.root.path(),
    )
    .unwrap();
    // Linux retains the descendant's slave. macOS revokes it on controlling-session
    // leader exit, so that platform cannot establish the no-EOF precondition.
    let script = r#"import os, signal, time, stat, subprocess
signal.signal(signal.SIGHUP, signal.SIG_IGN)
parent = os.getpid()
r, w = os.pipe()
pid = os.fork()
if pid == 0:
 signal.signal(signal.SIGTERM, signal.SIG_IGN)
 os.close(r)
 device = os.fstat(0).st_rdev
 with open('descendant-started', 'w') as trace:
  trace.write(str(os.getpid()))
 os.write(w, b'R')
 while True:
  observed = subprocess.run(['/bin/ps', '-o', 'stat=', '-p', str(parent)], capture_output=True, text=True)
  if observed.returncode != 0 or observed.stdout.strip().startswith('Z'):
   break
  time.sleep(0.005)
 with open('root-observed', 'w') as trace:
  trace.write(repr((observed.returncode, observed.stdout, observed.stderr, os.fstat(0))))
 assert stat.S_ISCHR(os.fstat(0).st_mode)
 assert os.fstat(0).st_rdev == device
 with open('held-after-root', 'w') as proof:
  proof.write(str(os.getpid()))
 time.sleep(60)
else:
 os.close(w)
 os.read(r, 1)
 print('ROOT-FINAL-OUTPUT', flush=True)
 os._exit(7)
"#;
    let shell = client
        .spawn(
            "spawn",
            &SpawnRequest {
                owner: TerminalOwner::Shell {
                    task_id: "root-exit".into(),
                    index: Some(0),
                },
                command: PreparedCommand {
                    program: "/usr/bin/python3".into(),
                    args: vec!["-c".into(), script.into()],
                    cwd: fixture.root.path().into(),
                    env: Default::default(),
                },
                columns: 80,
                rows: 24,
                image_protocol: None,
            },
        )
        .unwrap();
    let proof = fixture.root.path().join("held-after-root");
    let deadline = Instant::now() + Duration::from_secs(3);
    while !proof.exists() {
        if Instant::now() >= deadline {
            let events = client
                .events(0)
                .unwrap()
                .events
                .into_iter()
                .filter_map(|event| {
                    if let openforge_session_protocol::Event::Output { data, .. } = event {
                        Some(String::from_utf8_lossy(&data).into_owned())
                    } else {
                        None
                    }
                })
                .collect::<String>();
            panic!("descendant did not attest an open slave after root exit: {events}; inventory={:?}; child={:?}; root={:?}", client.inventory().unwrap(), std::fs::read_to_string(fixture.root.path().join("descendant-started")), std::fs::read_to_string(fixture.root.path().join("root-observed")));
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    loop {
        let session = client
            .inventory()
            .unwrap()
            .sessions
            .into_iter()
            .find(|s| s.pty == shell.pty)
            .unwrap();
        if session.exit_code == Some(7) {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "root exit hidden behind the attested descendant-held slave"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
    let descendant: usize = std::fs::read_to_string(proof).unwrap().parse().unwrap();
    client.terminate("stop-descendant", &shell.pty).unwrap();
    let processes = sysinfo::System::new_all();
    assert!(!processes
        .process(sysinfo::Pid::from(descendant))
        .is_some_and(|p| p.status() != sysinfo::ProcessStatus::Zombie));
}

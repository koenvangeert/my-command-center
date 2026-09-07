# Terminal recovery proof

KVG-4715 extends the KVG-4714 experiment. The release gate is **incomplete**. No production extraction or renderer migration is authorized.

## KVG-4760 owner-approved recovery contract

The owner confirmed this focused production fix. Ghostty captures portable VT, bounded compatibility/image replay, explicit parser continuation and the output watermark in one actor command. Continuation comes from Ghostty's replay-safe continuation API, not from a guessed retained-output suffix. Unavailable continuation still defers the snapshot without disabling the authority.

The xterm view drains earlier writes and resets its presentation and image addon. It replays compatibility data, sends byte CAN to cancel unfinished replay parser and UTF-8 input, repaints portable VT, and restores the explicit continuation last. Only then can the coordinator flush output newer than the snapshot watermark. A live snapshot missing continuation is refused; empty continuation explicitly means parser ground. Ghostty remains the only source of PTY protocol replies.

The parent probe now bundles the actual production `createXtermTerminalView` and calls `replaceSnapshot` and `writeLive`. It uses JSDOM and public presentation captures, not a second implementation of recovery ordering. Its four fixtures use the view's default 80-by-24 geometry. The earlier red report used 20-by-4 xterm terminals and remains unchanged.

Run the updated probe without overwriting the historical red evidence:

```sh
node scripts/experiments/pty-reexec/authority-proof.mjs \
  scripts/experiments/pty-reexec/evidence/macos-arm64-continuation.json
```

All four arm64 cases pass through the production view: split CSI, split UTF-8, alternate-screen return, and split query. No renderer replies reach the input callback. The binary Ghostty checkpoint comparisons also pass. The probe does not mount the desktop, test pixels, test images, cross IPC, or replace a live terminal model process.

`packages/terminal-runtime/src/xtermTerminalRecovery.integration.test.ts` separately exercises the real view and xterm image addon. It checks text, color, cursor, UTF-8, query suppression, image retention, alternate-screen return, and refusal without clearing when continuation is absent. Both desktop and Trusted Plugin adapter tests check continuation transport. The actor test checks continuation and ground state at distinct watermarks; existing overflow tests check deferred recovery.

The arm64 PTY rerun is recorded in `evidence/macos-arm64-continuation-pty.json`. Nine live tests and seven teardown tests pass. These independent process and descriptor observations still use the isolated PTY experiment, not a production daemon.

The parent gate is still incomplete. No macOS x64 execution is available. Supported-image coverage here is an inline-image fixture, not proof of arbitrary image-state retention beyond the compatibility budget. The broader stop-rule gaps listed below remain open.


## Historical KVG-4715 blocking result

Run from the repository root after `pnpm i`:

```sh
node scripts/experiments/pty-reexec/authority-proof.mjs \
  scripts/experiments/pty-reexec/evidence/macos-arm64-authority.json
```

The stopped proof at commit `2a4876ca5b6b477f3791d914c21587f89679aa72` exited 1. This was a failed acceptance gate, not an expected-failure test that could turn the gate green. The following describes that historical run.

The standalone Rust crate compiles OpenForge's actual `terminal_model.rs` and its worker modules unchanged. It uses the same pinned libghostty-vt revision as the Sidecar. The probe obtains real actor-captured compatibility replay, portable VT and watermark, then feeds real xterm with the current presentation recovery order: reset, compatibility replay, portable VT, later output. It does not use a screenshot or claim a raw suffix is a parser checkpoint. It does not invoke the desktop view or exercise images, mounts, IPC or actual reexec of a terminal model.

The uninterrupted xterm control and recovered xterm are compared through public buffer cell, color and cursor APIs. The actual Ghostty binary checkpoint is separately decoded and continued, with portable state and subsequent replies compared to the uninterrupted authority. These comparisons can disprove recovery but cannot establish complete parser equivalence for arbitrary inputs.

| Case | Binary authority checkpoint | Presentation recovery |
| --- | --- | --- |
| Split CSI, `BEFORE ESC [ 31` then `mRED` | Matches tested state and replies | `BEFOREmRED`, expected `BEFORERED`; color also differs |
| Split UTF-8 emoji | Matches tested state and replies | Emoji disappears |
| Alternate screen then return to primary | Matches tested state and replies | Matches |
| Split cursor-position query | Matches tested state and replies | `6n` appears as text |

The failing streams are 14 or 15 bytes in total. They fit entirely within the 256 KiB compatibility budget. All snapshots have watermark 1. Retention loss and stale-output replay do not explain these failures. Portable formatting does not continue the pending parser sequence left by compatibility replay before later bytes arrive.

[The arm64 report](evidence/macos-arm64-authority.json) records source hashes, actual/expected cells and assertions. The binary checkpoints are 1162 to 1320 bytes for these fixtures. This is not proof of a global state budget or image preservation.

This stopped result led to KVG-4760 and the owner-approved contract above. It did not authorize renderer migration, suffix-only recovery or production daemon extraction.

## Live failure handling established on arm64

```sh
python3 scripts/experiments/pty-reexec/run.py \
  --report scripts/experiments/pty-reexec/evidence/macos-arm64-recovery-green.json
python3 -m unittest discover -s scripts/experiments/pty-reexec -p 'test_*.py' -v
```

Nine live tests and seven teardown regressions pass. All nine live cleanup audits leave zero survivors. The deliberately stopped-host case still exercises emergency cleanup and expects the original timeout. New incompatible-target and controlled-initialization tests failed before implementation; their red reports are retained beside the green report.

The fixture now probes target state-format and structure-size compatibility in a separate child. That child closes inherited descriptors and binds stdio to `/dev/null` before executing the target. A probe must exit successfully within roughly two seconds or preparation is refused. The probe does not authenticate or code-sign an executable and is not a production preflight implementation.

An incompatible executable is refused before modifying the live checkpoint or descriptor flags. A target removed after successful preparation exercises an actual failed `execl`, leaving the old image usable. The controlled failing v2 image reads the retained checkpoint, increments a recovery counter, and reexecs the saved v1 path before acquiring PTY wrappers or consuming I/O. The test observes the final v1 executable at the same host PID, unchanged child start identities, unchanged PTY descriptors, slave paths, device identities and cursors, and exactly one observed response to the post-recovery input. A subsequent compatible v2 replacement works.

The inherited allowlist is still stdio, the unlinked checkpoint and owned PTY masters. The checkpoint adds a state-format tag, a bounded recovery-image path and a recovery counter. It remains a native, fixed-size experiment structure compiled with matching ABI, not a portable state protocol. No terminal state, listener, ownership lock or ingress journal is embedded in that checkpoint yet.

The isolated temporary directory retains v1 and v2 until cleanup. A missing/corrupt recovery image, a loader failure that kills the host, SIGKILL, or an arbitrary fatal initialization crash cannot be rescued by this checkpoint. Losing the host's last PTY master is fatal to continuity. No extra PTY-holding process or descriptor-transfer architecture was introduced.

## Validation and remaining work

Passed for the isolated experiment subsystem:

- Nine live macOS arm64 tests, including compilation with C warnings as errors.
- Seven Python teardown regressions and Python bytecode compilation.
- Clang static analysis for host and fixture, including the preflight header.
- `node --check scripts/experiments/pty-reexec/authority-proof.mjs`.
- Standalone authority crate `cargo test`, `cargo check`, `cargo build`, and `cargo clippy`, using `--offline --locked --manifest-path scripts/experiments/pty-reexec/authority/Cargo.toml` and the environment returned by `prepareGhosttyVt`. All 16 imported authority tests pass.
- Rust formatting checked with `rustfmt --check --edition 2021 --config skip_children=true scripts/experiments/pty-reexec/authority/src/main.rs`.

The authority/presentation gate fails as described above. Stop-rule gaps remain: supported images, real authority state across live PTY reexec, high-output backpressure and pause measurement, complete exactly-once input accounting under I/O races, malformed executable refusal coverage, listener/lock retention, global retained-state budgets and macOS x64 execution. Existing low-rate numbered-output and exit-race tests remain useful but do not satisfy those broader requirements.

Desktop, Sidecar, plugin and Terminal Runtime package suites were not run. Their production files and contracts were not changed. The actual authority module was compiled and its tests run in the isolated crate. No app restart, installation, database access or production process cleanup was performed.

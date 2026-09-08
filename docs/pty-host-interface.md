# PTY host interface

KVG-4716 introduces an opt-in Rust contract over the existing Rust Sidecar PTY owner. Existing provider, renderer, Companion and plugin entry points are unchanged. No caller migration, daemon process, executable replacement, persistent discovery or restart behavior is enabled.

The owner explicitly approved this prefactor before the broader replacement proof gate passes. The gaps recorded in `scripts/experiments/pty-reexec/RECOVERY.md`, including macOS x64 evidence, remain open. This interface is not evidence that replacement works.

## Entry point and ownership

`PtyManager::host(installation, events)` returns a `PtyHost` client. Supply the installation's stable app-data namespace identity and the same `AppEventBus` used by the runtime. All manager clones share one control ledger and owner lifetime. The client clones a reference to the existing manager; it never allocates another PTY manager.

`pty_manager/host` defines the contract and coordinates validated requests. `pty_manager/session/host_adapter` delegates to existing spawn arbitration, registration, terminal snapshots, ordered writes and verified process cleanup. The deterministic adapter exists only in tests.

The interface groups operations by purpose:

- `connect` takes control with a new controller generation and returns reconciled inventory. `reconcile` refreshes inventory without taking control again.
- `spawn` accepts a prepared command and a retry-stable operation identity. Repeating the same operation returns its original result, including after controller reconnection or child exit. A different payload under that operation identity is rejected. A new operation targeting an occupied session key retains the existing manager's replacement behavior.
- `attach_recover` subscribes before capturing a full terminal-authority snapshot. The attachment supplies live output, exit and recovery-required events.
- `io` orders input and resize together using a sequence starting at one per concrete PTY. Retrying an operation does not write twice. Reconnection does not reset the sequence. Inventory exposes `next_io_sequence` so a new controller can resume without the previous controller's local counter. `None` means the numeric sequence space is exhausted.
- `terminate` targets one concrete PTY identity, not every shell of a Task or a newly allocated PTY under the same key.
- `replacement` defines prepare, commit and abort phases. Every phase returns `UnsupportedReplacement` without mutating sessions.

Provider hook installation, command selection, Task/database updates and plugin business rules stay outside this interface. `PreparedCommand` contains program, arguments, environment and cwd, not provider callbacks. The existing adapter still applies the normal terminal environment. Existing shell defaults retain their precedence; prepared-agent environment is applied after those defaults, matching the two existing spawn paths. Provider-specific preparation must finish before submitting a request.

## Identities

| Identity | Meaning |
| --- | --- |
| `InstallationId` | Stable identifier for one app-data namespace, supplied by composition code. Not a PID, path credential or executable version. Persistence and authentication are later slices. |
| `DaemonLifetimeId` | Unique lifetime of this PTY owner. The name matches the future protocol, but this slice's owner is the existing manager. A future compatible reexec must retain it; a new manager gets a new value. |
| `ControllerGeneration` | Nonzero control generation. A successful connect advances it and fences older host clients and attachments. |
| `PtyIdentity` | Installation, owner lifetime and nonzero existing `instance_id`. A surviving PTY keeps its identity through controller changes. |
| `OperationId` | Retry-stable identity within one owner lifetime. Reusing a recorded identity with another request is an error. |
| `OutputPosition` | PTY identity plus terminal-authority watermark. It is not a byte offset or an app-event cursor. |

Text identities accept 1–128 ASCII letters, digits, dots, underscores or hyphens. Zero numeric identities are invalid. Output positions cannot cross installations, owner lifetimes or PTY allocations. A recovery request cannot claim a watermark ahead of the current authority.

Legacy calls do not acquire these generations. Their behavior remains unchanged, and they can still replace or terminate a session. The adapter checks concrete instance identity at the existing session-operation boundary so a stale host request cannot target the replacement PTY. This is an incremental migration boundary, not an assertion that all old callers are already fenced.

## Recovery and failure behavior

Recovery returns the existing Ghostty portable state, compatibility replay and parser continuation material. A client installs that snapshot before consuming later output. Frames at or below its watermark are discarded. A gap, malformed frame or legacy batch overlapping the watermark returns `RecoveryRequired`; discard the attachment and request another full recovery. The interface does not substitute a raw output suffix for parser state. No durable completed-terminal recovery is added here.

Attachments retain a dequeued event while waiting to revalidate the controller. Cancelling `recv` during that wait does not consume output or an exit; the next receive can deliver the same pending event without waiting for another frame.

Accepted mutations keep an owned asynchronous operation and the control gate until the adapter finishes, even if the waiting caller is cancelled. A new controller waits for that operation rather than abandoning a partially registered child or interrupted cleanup. A worker failure with no recorded result returns `OutcomeUnknown`; callers reconcile rather than automatically create another operation. Backend failures are retained as failed receipts.

Inventory includes every currently observed PTY plus at most 1,024 historical exits. The oldest exited allocations expire independently of operation receipts. Expiry cannot make a spawn retry launch another process. This does not introduce an exit-status journal, persisted operation receipts or a global event-cursor transaction with legacy callers. Cleaning and managed-recovery states remain visible. Existing public cleanup operations remain available for managed recovery.

The initial in-process ledger admits at most 1,024 ordinary operation receipts and 4 MiB of retained request payload. Another 1,024 receipts and 512 KiB are reserved for scoped cleanup. Requests and input frames are limited to 64 KiB. Host spawn admission refuses when 1,024 active PTYs are already observed, but never hides additional PTYs created by legacy callers. Current inventory is proportional to the existing owner's live population; only historical exit retention is capped. Receipt or history capacity cannot disable reconciliation or controller handoff. These are local contract limits, not proven daemon memory or replacement budgets.

## Verification

The shared contract exercises real isolated shell/agent fixtures and the deterministic adapter for retry-safe spawn, controller handoff, ordered input, resize, validation, exact-instance termination and unsupported replacement. Additional tests cover cancelled callers, receipt capacity, failed-spawn retry, stale output, malformed output and natural-exit reconciliation. Real fixtures use a temporary PID directory and clean up their manager even after an assertion failure.

Run the focused tests with:

```sh
cargo test --manifest-path "$(node scripts/rust-sidecar-layout.mjs manifest-path)" pty_manager::host::
```

Full affected-system validation includes the Backend Crate's test/check/build/clippy scripts, desktop tests/type/lint, Electron and Companion IPC contracts, and terminal/runtime/plugin package checks. The replacement feasibility and packaged restart matrix remain outside this slice and are not claimed green.

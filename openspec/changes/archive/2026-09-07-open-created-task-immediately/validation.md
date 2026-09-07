# Validation

## Automated checks

Full renderer validation was selected because the change moves asynchronous ownership from the dialog to the app and touches shared session actions and App test fixtures.

- `pnpm test`: passed, 747 suites and 6,291 tests. Four suites and 20 tests were skipped by the default run. This does not establish coverage for those skipped checks.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed, including unused Svelte imports, plugin import boundaries, and UI migration inventory.
- `git diff --check`: passed.
- Focused creation, compose, controller, session, and feedback tests passed before the full run. The full run also covers the final App test updates and the reviewer regression.

No Rust, Electron main/preload, shared package, IPC contract, or dependency source changed. Separate Rust and package validation was not required. The desktop launch rebuilt the existing sidecar, plugins, and Electron artifacts as prerequisites, not as substitute subsystem tests.

## Behavioral coverage

- Creation workflow and dialog tests cover immediate handoff, no intermediate saved screen, persistence failures with retained images, defaults validation, and repeated submission guards.
- Controller tests cover unresolved startup and refresh, failed refresh, saved-detail survival through a real stale cache refresh, and backlog saves preserving board, selected-task, and plugin locations.
- Compose tests cover saved-result delivery for both intents, no cancellation replacement, and a newer request surviving completion of older startup work.
- Production creation/session integration tests cover provider failure after dismissal, retry of the same saved task, and successful startup followed by refresh failure.
- Session tests cover cached branch preflight before list refresh, canceled workspace decisions, task-scoped errors, pending/active duplicate-start guards, retained terminals, and post-start presentation failure.
- Task feedback tests cover accessible pending/error states, task-specific retry, and suppression of retry for an already-running session. Task detail provider host and App suites pass with the feedback integration.

## Fresh-context review

One read-only reviewer examined the working tree against `f0dc9f61e2088d6c416cef850afd700e981d3f93`.

The reviewer requested changes for a P2 regression: checking the pending-start guard before the active-PTY path could silently drop user input while post-start refresh remained unresolved. Fixed by checking active-PTY input first. A new regression was observed failing before the fix and passes in the final full run.

The reviewer also noted that mocked cache publication did not prove retention across real refreshes. Added a controller regression using the real cache. No second review pass was run, per the review workflow.

## Desktop smoke test

Task 4.3 passed in an isolated Electron app with real task persistence. Slow/failing startup was injected at the desktop IPC boundary, so no real AI provider was launched. The driver verified:

- Save to backlog preserves the board location.
- Create & Start dismisses the dialog and opens the saved task while startup is still pending.
- The task page displays startup failure and Retry start retries the same identifier without another creation.
- Save to backlog from the selected task preserves that task and does not start the new backlog task.

Local evidence:

- `/tmp/KVG-4834-smoke.mjs`
- `/tmp/KVG-4834-smoke.log`
- `/tmp/KVG-4834-desktop/handoff-smoke.json`
- `/tmp/KVG-4834-desktop/startup-failure.png`
- `/tmp/KVG-4834-desktop/backlog-preserves-task.png`

The earlier reload timeout was a test setup problem involving initial-load timing and app unload handling. Electron logged fatal boot:renderer-load ERR_ABORTED when the driver reloaded before initial loadURL settled. The app also adapts beforeunload into its close-request flow. The successful driver waited for initial app readiness and removed the two unload listeners only in its owned fixture before reloading to install IPC interception. It then scoped the failure locator to the task banner, since the global toast contains the same error. No production reload or close behavior was changed.

All owned isolated app processes were shut down after each attempt. Real provider startup and the separate reload/quit behavior remain outside this smoke test's coverage; existing session tests cover the startup result handling.

## Follow-up

- KVG-4836: split the oversized dialog test suite and replace its adjacent stale compose fixture.
- KVG-4837: separate renderer reload from app quit handling and cover initial desktop load/reload readiness.

Both tasks depend on KVG-4834. Neither cleanup was included in this change.

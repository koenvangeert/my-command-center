# Replace AgentPanel with Embedded OpenCode TUI via xterm.js + PTY

## TL;DR

> **Quick Summary**: Replace the current plain-text `<pre>` agent output display with an embedded OpenCode TUI using xterm.js + portable-pty. The app spawns `opencode attach --session {id}` in a PTY piped to xterm.js, giving full TUI rendering (colors, formatting, tool visualization) with user interaction, while keeping the existing HTTP API orchestration for session creation and SSE-based completion detection.
>
> **Deliverables**:
> - New `pty_manager.rs` Rust module for PTY lifecycle management
> - New Tauri commands for PTY spawn/write/resize/kill
> - Rewritten `AgentPanel.svelte` with xterm.js terminal replacing `<pre>` text
> - Simplified `sse_bridge.rs` (completion/error/permission events only)
> - Frontend IPC wrappers and types for terminal operations
> - PTY cleanup on navigate-away, task delete, and app exit
> - Tests for new PTY manager and terminal component
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Validation → PtyManager → Tauri Commands → Integration → Tests

---

## Context

### Original Request
User asked whether it would be easier to show a terminal window with OpenCode connected to the same session, instead of the current custom-rendered plain text output. After discussion, we confirmed the approach: use xterm.js + portable-pty to embed the OpenCode TUI (via `opencode attach --session {id}`) in the task detail view.

### Interview Summary
**Key Discussions**:
- **Orchestration level**: Semi-orchestrated — app creates session + sends initial prompt, user can then see and interact with OpenCode TUI directly. App detects completion via SSE.
- **Completion detection**: Keep SSE bridge, simplified to only forward completion/error/permission events.
- **Status bar**: Keep the existing thin status bar (status dot, stage label, abort button) above the terminal.
- **Session history**: `opencode attach --session {id}` for both active and completed sessions.
- **Web UI rejected**: OpenCode's web interface has unwanted features (session management, settings). TUI via PTY is preferred.
- **Tests**: After implementation.

**Research Findings**:
- OpenCode v1.2.6 has `opencode attach <url> --session <id>` which attaches TUI to a running server's specific session.
- `portable-pty` is battle-tested (VS Code, RustDesk); reference implementations: `marc2332/tauri-terminal`, `talkcody`, `athasdev/athas`.
- xterm.js is industry standard; use directly (NOT the `@battlefieldduck/xterm-svelte` wrapper — adds unnecessary abstraction).
- OpenCode TUI uses standard ANSI/VT100 escape sequences, fully compatible with xterm.js.

### Metis Review
**Identified Gaps** (addressed):
- **Navigate-away behavior**: PTY killed on navigate-away, re-spawned on return (simplest for V1)
- **Permission prompts**: SSE bridge keeps forwarding `permission.updated`/`permission.replied` events; user can also approve directly in TUI
- **macOS PATH inheritance**: PTY CommandBuilder must inherit user shell environment (critical for production builds)
- **UTF-8 boundary splits**: PTY reader must buffer incomplete sequences across reads
- **Blocking I/O**: Must use `tokio::task::spawn_blocking` for PTY reader (NOT `tokio::spawn`)
- **CSS overflow conflict**: Left-column `overflow-y: auto` conflicts with xterm.js internal scrolling — change to `overflow: hidden`
- **PTY handle lifecycle**: Must store Child + MasterPty + writer together; dropping any kills process or breaks resize

---

## Work Objectives

### Core Objective
Replace AgentPanel's plain `<pre>` text rendering with an embedded xterm.js terminal that shows the OpenCode TUI via `opencode attach`, providing full TUI rendering with colors, formatting, tool visualization, and user interaction — while preserving the existing semi-orchestrated workflow.

### Concrete Deliverables
- `src-tauri/src/pty_manager.rs` — PTY lifecycle management module
- Updated `src-tauri/src/main.rs` — new Tauri commands for PTY operations
- Rewritten `src/components/AgentPanel.svelte` — xterm.js terminal + status bar
- Simplified `src-tauri/src/sse_bridge.rs` — remove text forwarding
- Updated `src/lib/ipc.ts` — terminal IPC wrappers
- Updated `src/lib/types.ts` — terminal-related types
- Updated `src/components/TaskDetailView.svelte` — CSS overflow fix
- Updated `src-tauri/Cargo.toml` — portable-pty dependency
- Updated `package.json` — xterm.js dependencies

### Definition of Done
- [ ] `cargo build` succeeds with no errors
- [ ] `npm run build` succeeds with no errors
- [ ] `cargo test` passes all tests (including new pty_manager tests)
- [ ] `npm run test` passes all tests (including new terminal tests)
- [ ] Opening a task with an active session shows the OpenCode TUI in full color
- [ ] Opening a task with a completed session shows the session history via TUI
- [ ] User can type in the terminal to interact with OpenCode
- [ ] Terminal resizes correctly when window is resized
- [ ] Abort button kills PTY + aborts session
- [ ] Navigating away and back re-attaches the terminal
- [ ] No orphan `opencode attach` processes after task deletion or app exit

### Must Have
- Full OpenCode TUI rendering (colors, ANSI escape codes, formatting)
- Bidirectional I/O (user can type, TUI responds)
- Terminal auto-resize via FitAddon
- PTY cleanup on all exit paths (navigate-away, task delete, app close)
- `TERM=xterm-256color` and `COLORTERM=truecolor` environment variables on PTY
- User shell environment inheritance for macOS production builds
- UTF-8 boundary handling in PTY reader
- SSE bridge still forwards completion/error/permission events

### Must NOT Have (Guardrails)
- **DO NOT** use the `@battlefieldduck/xterm-svelte` wrapper — use xterm.js directly with Svelte `bind:this` + `onMount`
- **DO NOT** modify `server_manager.rs` — OpenCode servers are still needed
- **DO NOT** modify `opencode_client.rs` — HTTP API still used for session creation/prompt
- **DO NOT** remove the SSE bridge entirely — simplify, don't delete
- **DO NOT** remove ANY App.svelte event listeners (`implementation-complete`, `implementation-failed`, `permission.updated`, `permission.replied`, `session-aborted`)
- **DO NOT** use `tokio::spawn` for PTY reader — MUST use `tokio::task::spawn_blocking` (portable-pty is blocking I/O)
- **DO NOT** use `String::from_utf8_lossy` without buffering incomplete UTF-8 sequences
- **DO NOT** drop the `MasterPty` handle after getting writer/reader (breaks resize)
- **DO NOT** build a custom terminal emulator, WebSocket bridge, input sanitization layer, or multi-terminal tabs
- **DO NOT** add terminal theming beyond matching the existing Tokyo Night palette
- **DO NOT** change the `activeSessions` store structure or `start_implementation` HTTP API flow

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Testing Library for frontend, Rust #[cfg(test)] for backend)
- **Automated tests**: Tests-after (implement first, then add tests)
- **Framework**: Vitest (frontend), cargo test (Rust)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Rust modules | Bash (cargo test/build) | Compile, run tests, check output |
| Frontend components | Bash (npm run test/build) | Run vitest, check for xterm.js mount |
| PTY behavior | interactive_bash (tmux) | Spawn opencode attach, verify TUI renders |
| Integration | Bash (cargo build && npm run build) | Full build succeeds |
| CSS fixes | Bash (npm run build) | No build errors |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — validation + dependencies, 3 parallel):
├── Task 1: Validate opencode attach assumptions [quick]
├── Task 2: Add portable-pty dependency + verify compile [quick]
└── Task 3: Install xterm.js packages + verify import [quick]

Wave 2 (After Wave 1 — core modules, 3 parallel):
├── Task 4: Create pty_manager.rs [deep]
├── Task 5: Create TerminalView in AgentPanel (xterm.js) [visual-engineering]
└── Task 6: Add terminal types + IPC wrappers [quick]

Wave 3 (After Wave 2 — wiring + integration, 3 parallel):
├── Task 7: Add Tauri commands + wire PTY→frontend (depends: 4, 6) [unspecified-high]
├── Task 8: Simplify SSE bridge (depends: none, but sequence after 7) [quick]
└── Task 9: Fix CSS layout conflicts (depends: 5) [quick]

Wave 4 (After Wave 3 — integration + edge cases, 2 parallel):
├── Task 10: Integrate PTY into start_implementation flow (depends: 7, 8) [deep]
└── Task 11: PTY cleanup + navigate-away handling (depends: 7) [unspecified-high]

Wave 5 (After Wave 4 — tests):
└── Task 12: Add tests for pty_manager + terminal component (depends: 10, 11) [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 7 → Task 10 → Task 12 → F1-F4
Parallel Speedup: ~55% faster than sequential
Max Concurrent: 3 (Waves 1, 2, 3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | — | 4, 5, 6 | 1 |
| 2 | — | 4 | 1 |
| 3 | — | 5, 6 | 1 |
| 4 | 1, 2 | 7, 10, 11 | 2 |
| 5 | 1, 3 | 9, 10 | 2 |
| 6 | 3 | 7 | 2 |
| 7 | 4, 6 | 10, 11 | 3 |
| 8 | — | 10 | 3 |
| 9 | 5 | 10 | 3 |
| 10 | 7, 8, 9 | 12 | 4 |
| 11 | 7 | 12 | 4 |
| 12 | 10, 11 | F1-F4 | 5 |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|----------------------|
| 1 | **3** | T1 → `quick`, T2 → `quick`, T3 → `quick` |
| 2 | **3** | T4 → `deep`, T5 → `visual-engineering`, T6 → `quick` |
| 3 | **3** | T7 → `unspecified-high`, T8 → `quick`, T9 → `quick` |
| 4 | **2** | T10 → `deep`, T11 → `unspecified-high` |
| 5 | **1** | T12 → `unspecified-high` |
| FINAL | **4** | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [ ] 1. Validate `opencode attach` Assumptions

  **What to do**:
  - Start a temporary `opencode serve --port 0` in any project directory
  - Create a session via the HTTP API, send a simple prompt, wait for completion
  - Test `opencode attach http://127.0.0.1:{port} --session {id}` for the completed session — verify it shows historical output
  - Test attach without `--password` — verify no auth is required when server has none
  - Test killing the attach process (`kill`) — verify it exits cleanly without corrupting the server
  - Test user input — verify typing in the attached TUI is forwarded to OpenCode
  - Document findings in `.sisyphus/evidence/task-1-attach-validation.md`

  **Must NOT do**:
  - Do not modify any project files
  - Do not install any dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: This is a validation/spike task — run commands and document results
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6 (all core modules need validated assumptions)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src-tauri/src/server_manager.rs:89-137` — How servers are currently spawned with dynamic port detection (to replicate for test)
  - `src-tauri/src/opencode_client.rs:65-95` — How sessions are created via HTTP API

  **API/Type References**:
  - `opencode attach --help` output: `opencode attach <url> -s <session_id>` — the command to test

  **External References**:
  - OpenCode v1.2.6 installed at `/Users/koen.vangeert/.opencode/bin/opencode`

  **WHY Each Reference Matters**:
  - server_manager.rs shows the exact `opencode serve --port 0` invocation pattern to replicate for testing
  - opencode_client.rs shows the HTTP API endpoints to use for session creation during validation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Validate attach to completed session shows history
    Tool: interactive_bash (tmux)
    Preconditions: opencode serve running on dynamic port, session completed
    Steps:
      1. Start opencode serve --port 0 in a temp directory, capture port from stdout
      2. Create session via curl POST http://127.0.0.1:{port}/session
      3. Send a simple prompt via curl POST http://127.0.0.1:{port}/session/{id}/message
      4. Wait for session.idle (poll GET /session/{id} until status is idle)
      5. Run opencode attach http://127.0.0.1:{port} --session {id} in tmux
      6. Capture screenshot of terminal output
      7. Verify TUI renders with content (not blank/error)
    Expected Result: OpenCode TUI shows the completed conversation with colors/formatting
    Failure Indicators: Blank screen, error message, "session not found", crash
    Evidence: .sisyphus/evidence/task-1-attach-completed.png

  Scenario: Validate attach works without password
    Tool: Bash (curl + tmux)
    Preconditions: opencode serve running without --password flag
    Steps:
      1. Run opencode attach http://127.0.0.1:{port} --session {id} (no -p flag)
      2. Verify it connects successfully (no auth error)
    Expected Result: Attach succeeds without authentication
    Failure Indicators: "401 Unauthorized", "password required", connection refused
    Evidence: .sisyphus/evidence/task-1-no-password.txt

  Scenario: Validate clean exit on kill
    Tool: interactive_bash (tmux)
    Preconditions: opencode attach running in tmux
    Steps:
      1. Get PID of opencode attach process
      2. Send SIGTERM to the process
      3. Wait 2 seconds
      4. Check if process is still running (ps aux | grep)
      5. Check if opencode serve is still healthy (curl /global/health)
    Expected Result: Attach exits cleanly, server remains healthy
    Failure Indicators: Zombie process, server crashes, port still occupied by dead process
    Evidence: .sisyphus/evidence/task-1-clean-exit.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-attach-completed.png — screenshot of TUI showing historical session
  - [ ] task-1-no-password.txt — terminal output of successful passwordless attach
  - [ ] task-1-clean-exit.txt — output confirming clean process exit
  - [ ] task-1-attach-validation.md — full findings document

  **Commit**: NO (validation only, no code changes)

- [ ] 2. Add `portable-pty` Dependency + Verify Compile

  **What to do**:
  - Add `portable-pty` to `src-tauri/Cargo.toml` dependencies
  - Run `cargo build` from `src-tauri/` to verify it compiles on macOS ARM64
  - Verify no dependency conflicts with existing crates (rusqlite, tokio, etc.)
  - If compile fails, document the error and try alternative version or `pty-process` crate

  **Must NOT do**:
  - Do not write any Rust code beyond the Cargo.toml change
  - Do not modify any existing .rs files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single dependency addition + build verification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4 (PtyManager needs the crate)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/Cargo.toml` — existing dependencies to check for conflicts (tokio, serde, etc.)

  **External References**:
  - `portable-pty` crate: https://crates.io/crates/portable-pty
  - Reference: `marc2332/tauri-terminal` uses portable-pty successfully with Tauri

  **WHY Each Reference Matters**:
  - Cargo.toml shows existing dependency versions to ensure compatibility

  **Acceptance Criteria**:
  - [ ] `portable-pty` added to Cargo.toml
  - [ ] `cargo build` succeeds in src-tauri/ with no errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: portable-pty compiles on macOS ARM64
    Tool: Bash
    Preconditions: Existing project compiles successfully
    Steps:
      1. Run: cargo build (from src-tauri/)
      2. Check exit code is 0
      3. Verify no warnings about portable-pty specifically
    Expected Result: Build succeeds, portable-pty is included
    Failure Indicators: Compile error mentioning portable-pty, linker errors, missing system deps
    Evidence: .sisyphus/evidence/task-2-cargo-build.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-cargo-build.txt — cargo build output

  **Commit**: YES (groups with Task 3)
  - Message: `chore(deps): add portable-pty and xterm.js dependencies`
  - Files: `src-tauri/Cargo.toml`
  - Pre-commit: `cargo build`

- [ ] 3. Install xterm.js Packages + Verify Import

  **What to do**:
  - Run `npm install xterm @xterm/addon-fit` in project root
  - Verify packages install without errors
  - Verify TypeScript can resolve the imports (create a temporary test or check types)
  - Note: Do NOT install `@battlefieldduck/xterm-svelte` — use xterm.js directly

  **Must NOT do**:
  - Do not install the Svelte xterm wrapper (`@battlefieldduck/xterm-svelte`)
  - Do not create any component files yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Package installation + verification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 5, 6 (frontend components need xterm.js types)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `package.json` — existing dependencies to check for conflicts
  - `tsconfig.json` — TypeScript config that must resolve xterm.js types

  **External References**:
  - xterm.js: https://xtermjs.org/docs/api/terminal/classes/terminal/
  - FitAddon: https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit

  **WHY Each Reference Matters**:
  - package.json shows existing dep structure; tsconfig shows module resolution settings

  **Acceptance Criteria**:
  - [ ] `xterm` and `@xterm/addon-fit` in package.json dependencies
  - [ ] `npm run build` succeeds (no type resolution errors from new packages)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: xterm.js packages install and resolve
    Tool: Bash
    Preconditions: Existing project builds successfully
    Steps:
      1. Run: npm install xterm @xterm/addon-fit
      2. Verify exit code 0
      3. Run: npm run build
      4. Verify build succeeds
    Expected Result: Packages installed, build passes
    Failure Indicators: npm install errors, TypeScript resolution failures
    Evidence: .sisyphus/evidence/task-3-npm-install.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-npm-install.txt — npm install + build output

  **Commit**: YES (groups with Task 2)
  - Message: `chore(deps): add portable-pty and xterm.js dependencies`
  - Files: `package.json`, `package-lock.json`
  - Pre-commit: `npm run build`

- [ ] 4. Create `pty_manager.rs` — PTY Lifecycle Manager

  **What to do**:
  - Create `src-tauri/src/pty_manager.rs` following the pattern of `server_manager.rs`
  - Define `PtyError` enum (SpawnFailed, ProcessNotFound, IoError, WriteFailed)
  - Define `PtySession` struct that owns: `Child`, `MasterPty`, AND `Box<dyn Write + Send>` (writer). All three must be stored — dropping any kills the process or breaks resize.
  - Define `PtyManager` struct with `Arc<Mutex<HashMap<String, PtySession>>>` (keyed by task_id)
  - Implement methods:
    - `spawn_pty(task_id, server_port, opencode_session_id, cols, rows, app_handle)` — spawns `opencode attach http://127.0.0.1:{port} --session {id}` in a PTY, starts reader thread, returns Ok
    - `write_pty(task_id, data)` — writes bytes to PTY stdin
    - `resize_pty(task_id, cols, rows)` — resizes PTY via MasterPty
    - `kill_pty(task_id)` — kills PTY process, cleans up handles
    - `kill_all()` — kills all active PTYs
  - PTY CommandBuilder MUST:
    - Set `TERM=xterm-256color` and `COLORTERM=truecolor` env vars
    - Inherit user shell environment (for macOS GUI app PATH). Use pattern: spawn login shell with `-ilc env` to capture user's full environment, parse and apply it.
    - Set working directory to the task's worktree path (if available)
  - PTY reader:
    - MUST use `tokio::task::spawn_blocking` (NOT `tokio::spawn` — portable-pty is blocking I/O)
    - MUST handle UTF-8 boundary splits — buffer incomplete multi-byte sequences across reads (follow `athasdev/athas` `find_utf8_boundary` pattern)
    - Emit Tauri event `pty-output-{task_id}` with the text data
    - On reader error/EOF, emit `pty-exit-{task_id}` event
  - Drop the `slave` handle after spawn (before starting reader)
  - Add 50ms sleep after PTY spawn on macOS before starting reader (PTY initialization delay)
  - Add `mod pty_manager;` to main.rs
  - PID file tracking in `~/.ai-command-center/pids/` (same pattern as server_manager)

  **Must NOT do**:
  - Do not use `tokio::spawn` for the reader loop
  - Do not use `String::from_utf8_lossy` without buffering incomplete sequences
  - Do not drop MasterPty after getting reader/writer
  - Do not add Tauri commands yet (that's Task 7)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex Rust module with async/blocking I/O, PTY lifecycle management, UTF-8 handling — requires careful implementation
  - **Skills**: [`golang`]
    - `golang`: Omitted (Rust, not Go)
  - **Skills Evaluated but Omitted**:
    - `golang`: Wrong language

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 7, 10, 11
  - **Blocked By**: Tasks 1 (validation), 2 (portable-pty dep)

  **References**:

  **Pattern References**:
  - `src-tauri/src/server_manager.rs` — FOLLOW THIS PATTERN exactly: `Arc<Mutex<HashMap>>`, error enum with Display + Error, PID file tracking in `~/.ai-command-center/pids/`, graceful shutdown with timeout
  - `src-tauri/src/server_manager.rs:89-137` — spawn_server method pattern (spawn + capture handles + health check + store)
  - `src-tauri/src/server_manager.rs:144-187` — stop_server method pattern (remove from map, SIGTERM, timeout, force kill)

  **External References**:
  - Reference implementation 1: `talkcody/talkcody/src-tauri/src/terminal.rs` — Tauri PTY commands with `tokio::task::spawn_blocking` for reader
  - Reference implementation 2: `athasdev/athas/src-tauri/src/terminal/connection.rs` — UTF-8 boundary handling (`find_utf8_boundary` function) + user environment inheritance
  - portable-pty API: `PtySize`, `native_pty_system()`, `openpty()`, `CommandBuilder`, `spawn_command()`

  **WHY Each Reference Matters**:
  - server_manager.rs: The EXACT struct/method/error pattern to follow — ensures consistency across the codebase
  - talkcody: Shows how to correctly use `spawn_blocking` for the reader loop and store Child+MasterPty+writer
  - athas: Shows the UTF-8 boundary buffering that prevents corrupted characters, and the macOS PATH inheritance pattern

  **Acceptance Criteria**:
  - [ ] `src-tauri/src/pty_manager.rs` exists with all specified methods
  - [ ] `mod pty_manager;` added to `src-tauri/src/main.rs`
  - [ ] `cargo build` succeeds

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: PtyManager compiles and basic structure is correct
    Tool: Bash
    Preconditions: portable-pty in Cargo.toml, main.rs has mod pty_manager
    Steps:
      1. Run: cargo build (from src-tauri/)
      2. Verify exit code 0
      3. Grep pty_manager.rs for: PtyManager struct, spawn_pty fn, write_pty fn, resize_pty fn, kill_pty fn
      4. Grep for tokio::task::spawn_blocking (must be present, NOT tokio::spawn)
      5. Grep for TERM and COLORTERM env var setting
      6. Grep for find_utf8_boundary or equivalent UTF-8 boundary handling
    Expected Result: All methods present, correct async pattern used, env vars set, UTF-8 handled
    Failure Indicators: Missing methods, tokio::spawn instead of spawn_blocking, no UTF-8 handling
    Evidence: .sisyphus/evidence/task-4-pty-manager-build.txt

  Scenario: Error enum follows server_manager pattern
    Tool: Bash
    Preconditions: pty_manager.rs exists
    Steps:
      1. Grep for PtyError enum definition
      2. Verify it implements Display and std::error::Error
      3. Verify variants: SpawnFailed, ProcessNotFound, IoError, WriteFailed
    Expected Result: Error type matches server_manager.rs pattern
    Failure Indicators: Missing Display impl, wrong variant names
    Evidence: .sisyphus/evidence/task-4-error-pattern.txt
  ```

  **Evidence to Capture:**
  - [ ] task-4-pty-manager-build.txt — cargo build output + grep verification
  - [ ] task-4-error-pattern.txt — error enum verification

  **Commit**: YES
  - Message: `feat(backend): add PTY manager for terminal lifecycle`
  - Files: `src-tauri/src/pty_manager.rs`, `src-tauri/src/main.rs` (mod declaration only)
  - Pre-commit: `cargo build`

- [ ] 5. Create Terminal View in AgentPanel (xterm.js)

  **What to do**:
  - Rewrite the output area of `src/components/AgentPanel.svelte` to embed xterm.js
  - KEEP the existing status bar (status dot, stage label, abort button, auto-scroll toggle) — it stays above the terminal
  - REPLACE the `<div class="output-container">` content with an xterm.js terminal
  - Use xterm.js directly (NOT `@battlefieldduck/xterm-svelte`):
    - Import `Terminal` from `xterm` and `FitAddon` from `@xterm/addon-fit`
    - Create a container div with `bind:this={terminalContainer}`
    - In `onMount`: create Terminal instance, load FitAddon, open terminal in container, call `fitAddon.fit()`
    - In `onDestroy`: dispose terminal
    - Import xterm.js CSS: `import 'xterm/css/xterm.css'`
  - Terminal theme should match the existing Tokyo Night palette:
    - Background: `var(--bg-primary)` value
    - Foreground: `var(--text-primary)` value
    - Cursor: `var(--accent)` value
  - Add ResizeObserver on the terminal container to call `fitAddon.fit()` on resize
  - Wire `terminal.onData(data => { /* will call IPC in Task 10 */ })` — for now, just console.log
  - Keep the empty state UI for when no session exists
  - Keep the loading spinner for loadingHistory state
  - REMOVE the `<pre class="output-text">` rendering (replaced by terminal)
  - REMOVE the completion-banner and error-banner inline renderings (status bar handles this)

  **Must NOT do**:
  - Do not install or use `@battlefieldduck/xterm-svelte`
  - Do not wire IPC calls yet (that's Task 10)
  - Do not remove the status bar or its event listeners
  - Do not remove the `listen('agent-event')` handler (SSE events still needed for status)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component work — terminal embedding, CSS theming, responsive layout
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Terminal integration requires careful CSS/layout work to avoid conflicts

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Tasks 9 (CSS fix), 10 (integration)
  - **Blocked By**: Tasks 1 (validation confirms attach works), 3 (xterm.js packages)

  **References**:

  **Pattern References**:
  - `src/components/AgentPanel.svelte:1-157` — KEEP: all script logic for status bar, SSE event handling (lines 68-103), session state management. MODIFY: output rendering section
  - `src/components/AgentPanel.svelte:159-233` — MODIFY: the template. Keep status-bar div, replace output-container content with xterm.js
  - `src/components/AgentPanel.svelte:236-554` — MODIFY: the styles. Keep status bar styles, replace output-text styles with terminal styles

  **API/Type References**:
  - `src/lib/types.ts:95-100` — AgentEvent type (still used for SSE status events)

  **External References**:
  - xterm.js Terminal API: constructor options (theme, fontFamily, fontSize, cursorBlink)
  - xterm.js FitAddon: `fit()` method for auto-sizing
  - xterm.js CSS: `import 'xterm/css/xterm.css'` required for rendering

  **WHY Each Reference Matters**:
  - AgentPanel.svelte lines 1-157: The status bar logic and SSE event handlers must be preserved exactly — they drive the status dot, stage label, and completion detection
  - AgentPanel.svelte lines 159-233: Shows the current template structure — the xterm.js terminal replaces only the content inside output-container

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] AgentPanel contains xterm.js Terminal instance
  - [ ] Status bar (dot, stage, abort, auto-scroll) still renders
  - [ ] Empty state still shows when no session exists
  - [ ] xterm.js CSS is imported

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AgentPanel builds with xterm.js integration
    Tool: Bash
    Preconditions: xterm packages installed (Task 3)
    Steps:
      1. Run: npm run build
      2. Verify exit code 0
      3. Grep AgentPanel.svelte for: import.*xterm, import.*FitAddon, Terminal(, fitAddon.fit
      4. Grep for: import 'xterm/css/xterm.css' (CSS import present)
      5. Verify <pre class="output-text"> is REMOVED
    Expected Result: Build passes, xterm.js is integrated, old pre-tag rendering is gone
    Failure Indicators: Build error, missing xterm imports, pre-tag still present
    Evidence: .sisyphus/evidence/task-5-build.txt

  Scenario: Status bar preserved in template
    Tool: Bash
    Preconditions: AgentPanel.svelte modified
    Steps:
      1. Grep AgentPanel.svelte for: class="status-bar"
      2. Grep for: class="status-dot"
      3. Grep for: class="abort-button"
      4. Grep for: listen.*agent-event (SSE listener still present)
    Expected Result: All status bar elements and SSE listener preserved
    Failure Indicators: Missing status bar, removed event listener
    Evidence: .sisyphus/evidence/task-5-status-bar.txt
  ```

  **Evidence to Capture:**
  - [ ] task-5-build.txt — build output + grep verification
  - [ ] task-5-status-bar.txt — status bar preservation verification

  **Commit**: YES (groups with Task 6)
  - Message: `feat(frontend): add xterm.js terminal component and IPC types`
  - Files: `src/components/AgentPanel.svelte`
  - Pre-commit: `npm run build`

- [ ] 6. Add Terminal Types + IPC Wrappers

  **What to do**:
  - Add terminal-related types to `src/lib/types.ts`:
    - `PtySpawnRequest { task_id: string; server_port: number; opencode_session_id: string; cols: number; rows: number }`
    - `PtyEvent { task_id: string; data: string }` (for pty-output events)
  - Add IPC wrapper functions to `src/lib/ipc.ts`:
    - `spawnPty(request: PtySpawnRequest): Promise<void>` → invoke `pty_spawn`
    - `writePty(taskId: string, data: string): Promise<void>` → invoke `pty_write`
    - `resizePty(taskId: string, cols: number, rows: number): Promise<void>` → invoke `pty_resize`
    - `killPty(taskId: string): Promise<void>` → invoke `pty_kill`
  - Follow the existing ipc.ts pattern exactly (typed wrappers around invoke)

  **Must NOT do**:
  - Do not modify existing types or IPC functions
  - Do not add store-level state for terminals (not needed — terminal state lives in xterm.js)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small TypeScript additions following established patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 7 (Tauri commands need matching IPC signatures)
  - **Blocked By**: Task 3 (need types to be resolvable)

  **References**:

  **Pattern References**:
  - `src/lib/ipc.ts` — FOLLOW THIS PATTERN exactly: typed async functions wrapping `invoke<T>(command_name, args)`
  - `src/lib/types.ts:95-107` — Existing event/status types to reference for naming conventions

  **WHY Each Reference Matters**:
  - ipc.ts: Shows the exact pattern for wrapping Tauri invoke calls — must match for consistency
  - types.ts: Shows naming conventions (PascalCase interfaces, snake_case fields matching Rust serde)

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] types.ts has PtySpawnRequest and PtyEvent interfaces
  - [ ] ipc.ts has spawnPty, writePty, resizePty, killPty functions

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Types and IPC wrappers compile
    Tool: Bash
    Preconditions: xterm packages installed
    Steps:
      1. Run: npm run build
      2. Verify exit code 0
      3. Grep types.ts for: PtySpawnRequest, PtyEvent
      4. Grep ipc.ts for: spawnPty, writePty, resizePty, killPty
    Expected Result: All types and functions present, build passes
    Failure Indicators: Build error, missing types or functions
    Evidence: .sisyphus/evidence/task-6-types-ipc.txt
  ```

  **Evidence to Capture:**
  - [ ] task-6-types-ipc.txt — build output + grep verification

  **Commit**: YES (groups with Task 5)
  - Message: `feat(frontend): add xterm.js terminal component and IPC types`
  - Files: `src/lib/types.ts`, `src/lib/ipc.ts`
  - Pre-commit: `npm run build`

- [ ] 7. Add Tauri Commands for PTY Lifecycle

  **What to do**:
  - Add new Tauri commands to `src-tauri/src/main.rs`:
    - `pty_spawn(task_id, server_port, opencode_session_id, cols, rows)` — calls PtyManager.spawn_pty(), returns Result<(), String>
    - `pty_write(task_id, data)` — calls PtyManager.write_pty(), returns Result<(), String>
    - `pty_resize(task_id, cols, rows)` — calls PtyManager.resize_pty(), returns Result<(), String>
    - `pty_kill(task_id)` — calls PtyManager.kill_pty(), returns Result<(), String>
  - Add `PtyManager` to Tauri app state (same pattern as ServerManager — `Mutex<PtyManager>`)
  - Register PtyManager in `setup()` via `app.manage()`
  - Register all 4 commands in the `invoke_handler` list
  - Follow the existing command pattern: accept `State<'_, Mutex<PtyManager>>`, return `Result<T, String>`, convert errors with `.map_err(|e| format!(...))`

  **Must NOT do**:
  - Do not modify existing commands
  - Do not integrate into `start_implementation` flow yet (that's Task 10)
  - Do not modify server_manager.rs or opencode_client.rs

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Tauri command wiring with state management — moderate complexity, needs precision
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 4 (PtyManager must exist), 6 (IPC signatures define the contract)

  **References**:

  **Pattern References**:
  - `src-tauri/src/main.rs` — FOLLOW the existing Tauri command pattern: `#[tauri::command] async fn`, `State<'_, Mutex<T>>`, `Result<T, String>`, `.map_err(|e| format!(...))`
  - `src-tauri/src/main.rs` — Look at how `ServerManager` is managed in app state and registered in setup()
  - `src-tauri/src/main.rs` — Look at the `.invoke_handler(tauri::generate_handler![...])` list for where to add new commands

  **API/Type References**:
  - `src-tauri/src/pty_manager.rs` — PtyManager public API (from Task 4)
  - `src/lib/ipc.ts` — IPC function signatures that these commands must match (from Task 6)

  **WHY Each Reference Matters**:
  - main.rs command pattern: Every command follows the same shape — matching this is non-negotiable for codebase consistency
  - PtyManager: These commands are thin wrappers around PtyManager methods — the Tauri layer just does state extraction and error conversion

  **Acceptance Criteria**:
  - [ ] `cargo build` succeeds
  - [ ] All 4 commands registered in invoke_handler
  - [ ] PtyManager in app state

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Tauri commands compile and are registered
    Tool: Bash
    Preconditions: pty_manager.rs exists (Task 4)
    Steps:
      1. Run: cargo build (from src-tauri/)
      2. Verify exit code 0
      3. Grep main.rs for: fn pty_spawn, fn pty_write, fn pty_resize, fn pty_kill
      4. Grep main.rs for: pty_spawn, pty_write, pty_resize, pty_kill in generate_handler!
      5. Grep main.rs for: PtyManager in manage() or setup()
    Expected Result: All commands present, registered, PtyManager in state
    Failure Indicators: Missing commands, not in handler list, PtyManager not managed
    Evidence: .sisyphus/evidence/task-7-commands.txt
  ```

  **Evidence to Capture:**
  - [ ] task-7-commands.txt — build output + grep verification

  **Commit**: YES
  - Message: `feat(backend): add Tauri commands for PTY spawn/write/resize/kill`
  - Files: `src-tauri/src/main.rs`
  - Pre-commit: `cargo build`

- [ ] 8. Simplify SSE Bridge — Remove Text Forwarding

  **What to do**:
  - Modify `src-tauri/src/sse_bridge.rs` to stop forwarding `message.part.delta` events to the frontend
  - KEEP forwarding these event types (required for status tracking and orchestration):
    - `session.idle` — completion detection
    - `session.status` — completion detection (when status.type === "idle")
    - `session.error` — error detection
    - `permission.updated` — permission prompt handling
    - `permission.replied` — permission prompt handling
  - KEEP the `implementation-complete` and `implementation-failed` emission logic
  - KEEP the `AgentEventPayload` struct (App.svelte and other listeners depend on it)
  - Add an early `continue` (or skip emit) for `message.part.delta` and `message.part.updated` event types — the PTY now handles text display
  - Optionally also skip: `message.updated`, `message.removed`, `server.heartbeat`, `server.connected` (these are not needed by the frontend)

  **Must NOT do**:
  - Do not remove the SSE bridge module entirely
  - Do not remove AgentEventPayload struct
  - Do not change the bridge connection logic (reconnect, URL format, etc.)
  - Do not remove `implementation-complete` / `implementation-failed` emission

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small targeted modification to an existing module — filtering which events get forwarded
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: Task 10 (integration needs simplified bridge)
  - **Blocked By**: None (logically independent, but sequenced after Wave 2 for safety)

  **References**:

  **Pattern References**:
  - `src-tauri/src/sse_bridge.rs:137-203` — The event handling match block. This is where to add the filter. Currently ALL events are forwarded; add early skip for text-streaming events.

  **WHY Each Reference Matters**:
  - sse_bridge.rs:137-203: This is the EXACT code section to modify — the match on real_event_type where events are forwarded to frontend

  **Acceptance Criteria**:
  - [ ] `cargo build` succeeds
  - [ ] `message.part.delta` events are NOT emitted to frontend
  - [ ] `session.idle`, `session.status`, `session.error`, `permission.updated`, `permission.replied` still emitted
  - [ ] `implementation-complete` and `implementation-failed` emissions preserved

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: SSE bridge compiles with event filtering
    Tool: Bash
    Preconditions: sse_bridge.rs modified
    Steps:
      1. Run: cargo build (from src-tauri/)
      2. Verify exit code 0
      3. Grep sse_bridge.rs for: message.part.delta — should appear in a skip/continue condition, not in an emit path
      4. Grep sse_bridge.rs for: session.idle — should still be in an emit path
      5. Grep sse_bridge.rs for: implementation-complete — should still be emitted
      6. Grep for AgentEventPayload struct — must still exist
    Expected Result: Build passes, text events filtered, status events preserved
    Failure Indicators: Build error, text events still forwarded, status events removed
    Evidence: .sisyphus/evidence/task-8-sse-simplify.txt
  ```

  **Evidence to Capture:**
  - [ ] task-8-sse-simplify.txt — build output + grep verification

  **Commit**: YES
  - Message: `refactor(backend): simplify SSE bridge to completion/error events only`
  - Files: `src-tauri/src/sse_bridge.rs`
  - Pre-commit: `cargo build`

- [ ] 9. Fix CSS Layout Conflicts for Terminal Hosting

  **What to do**:
  - In `src/components/TaskDetailView.svelte`, change `.left-column` CSS:
    - FROM: `overflow-y: auto;`
    - TO: `overflow: hidden;` (xterm.js manages its own scrolling)
  - In `src/components/AgentPanel.svelte`, update the `.output-container` CSS:
    - FROM: `overflow-y: auto;`
    - TO: `overflow: hidden;` (when hosting terminal)
  - Ensure the terminal container div has `width: 100%; height: 100%` and `position: relative` (xterm.js needs this)
  - The AgentPanel's `.agent-panel` should use `display: flex; flex-direction: column; height: 100%` with the terminal container getting `flex: 1; min-height: 0;`

  **Must NOT do**:
  - Do not change the right-column (TaskInfoPanel) styles
  - Do not change the status bar styles
  - Do not change the responsive breakpoint styles (those are fine)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted CSS changes in 2 files — small and specific
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: CSS layout changes for terminal hosting need careful consideration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Task 10 (integration needs correct layout)
  - **Blocked By**: Task 5 (xterm.js component must be in place)

  **References**:

  **Pattern References**:
  - `src/components/TaskDetailView.svelte:136-159` — `.detail-body`, `.left-column`, `.divider`, `.right-column` layout — the left-column overflow change goes here
  - `src/components/AgentPanel.svelte:236-440` — `.agent-panel`, `.output-container` styles — the overflow and flex changes go here

  **WHY Each Reference Matters**:
  - TaskDetailView CSS: The `overflow-y: auto` on .left-column WILL cause double scrollbars with xterm.js — this is a known conflict
  - AgentPanel CSS: The output-container needs `overflow: hidden` and proper flex sizing for xterm.js to fill the space correctly

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] `.left-column` has `overflow: hidden` (not `overflow-y: auto`)
  - [ ] Terminal container has correct flex sizing

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: CSS changes build correctly
    Tool: Bash
    Preconditions: AgentPanel has xterm.js (Task 5)
    Steps:
      1. Run: npm run build
      2. Verify exit code 0
      3. Grep TaskDetailView.svelte styles for: overflow: hidden (in left-column)
      4. Verify overflow-y: auto is NOT present for left-column
    Expected Result: Build passes, correct overflow values
    Failure Indicators: Build error, overflow-y: auto still present
    Evidence: .sisyphus/evidence/task-9-css-fix.txt
  ```

  **Evidence to Capture:**
  - [ ] task-9-css-fix.txt — build output + grep verification

  **Commit**: YES
  - Message: `fix(frontend): update CSS overflow for terminal hosting`
  - Files: `src/components/TaskDetailView.svelte`, `src/components/AgentPanel.svelte`
  - Pre-commit: `npm run build`

- [ ] 10. Integrate PTY into `start_implementation` Flow + Wire Frontend

  **What to do**:
  - **Backend integration** — In `src-tauri/src/main.rs`, update `start_implementation` (or `get_session_output`) to return the `opencode_session_id` and `server_port` to the frontend so it can spawn the PTY terminal. The frontend needs: `{ task_id, worktree_path, port, session_id: opencode_session_id }`.
    - Check the existing `ImplementationStatus` return type — it already has `task_id`, `worktree_path`, `port`, `session_id`. Verify `session_id` is the OpenCode session ID. If so, no backend changes needed!
  - **Frontend wiring** — In `src/components/AgentPanel.svelte`:
    - When a session becomes active (either from `start_implementation` response or from `activeSessions` store), get the opencode_session_id and server_port
    - Call `spawnPty({ task_id: taskId, server_port: port, opencode_session_id: sessionId, cols: terminal.cols, rows: terminal.rows })`
    - The spawn sequence MUST be: mount xterm.js → FitAddon.fit() → measure cols/rows → THEN call spawnPty → THEN start listening for pty-output
    - Listen for `pty-output-{taskId}` Tauri events → call `terminal.write(data)` to render TUI output
    - Listen for `pty-exit-{taskId}` Tauri events → update status accordingly
    - Wire `terminal.onData(data => writePty(taskId, data))` for user input
    - Wire ResizeObserver → `fitAddon.fit()` → `resizePty(taskId, terminal.cols, terminal.rows)`
  - **Session history** — When user opens a completed task:
    - Get session from `activeSessions` store or via `getLatestSession(taskId)` (existing flow)
    - If session has `opencode_session_id` and server is still running (check via IPC), spawn PTY with attach
    - If server is NOT running, spawn server first (the existing `start_implementation` path handles this), then spawn PTY
    - Fallback: if attach fails for completed sessions, show a message "Session history unavailable" instead of crashing
  - **Abort integration** — Update the abort handler:
    - Call `killPty(taskId)` to kill the PTY process
    - Then call the existing `abortImplementation(taskId)` to abort the OpenCode session
    - The SSE bridge will detect session.error and emit implementation-failed

  **Must NOT do**:
  - Do not modify the session creation or prompt sending flow (that stays in agent_coordinator)
  - Do not remove the SSE event listeners from AgentPanel (still needed for status detection)
  - Do not change the `activeSessions` store structure

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration task — frontend+backend coordination, multiple event flows, error handling, session history fallback
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Integration involves careful UI state management and event wiring

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (with Task 11)
  - **Blocks**: Task 12 (tests)
  - **Blocked By**: Tasks 7, 8, 9 (all wiring + SSE simplification + CSS must be done)

  **References**:

  **Pattern References**:
  - `src/components/AgentPanel.svelte:22-59` — loadSessionHistory() function — this is the entry point for both active and historical sessions; modify to trigger PTY spawn instead of text fetch
  - `src/components/AgentPanel.svelte:61-104` — onMount + event listener — modify to also set up PTY event listeners
  - `src/components/AgentPanel.svelte:118-126` — handleAbort() — extend to also kill PTY
  - `src/lib/types.ts:102-107` — ImplementationStatus type — verify it contains opencode_session_id

  **API/Type References**:
  - `src/lib/ipc.ts` — spawnPty, writePty, resizePty, killPty functions (from Task 6)
  - `src/lib/types.ts` — PtySpawnRequest, ImplementationStatus (from Tasks 6, existing)

  **WHY Each Reference Matters**:
  - AgentPanel.svelte:22-59: The session loading logic determines whether to show terminal or empty state — this is the integration point
  - AgentPanel.svelte:118-126: Abort must now kill PTY before aborting session — order matters (PTY first, then API abort)
  - ImplementationStatus: The existing return type may already have everything needed for PTY spawn — check before adding fields

  **Acceptance Criteria**:
  - [ ] `cargo build` succeeds
  - [ ] `npm run build` succeeds
  - [ ] PTY spawns when opening a task with an active session
  - [ ] User input is forwarded to PTY
  - [ ] Terminal resizes correctly
  - [ ] Abort kills PTY + aborts session
  - [ ] Completed sessions can be viewed (attach to existing or fallback message)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full integration builds
    Tool: Bash
    Preconditions: All previous tasks complete
    Steps:
      1. Run: cargo build (from src-tauri/)
      2. Run: npm run build
      3. Verify both exit code 0
    Expected Result: Full stack builds with no errors
    Failure Indicators: Compile errors, type mismatches between frontend/backend
    Evidence: .sisyphus/evidence/task-10-integration-build.txt

  Scenario: PTY event wiring present in AgentPanel
    Tool: Bash
    Preconditions: AgentPanel.svelte updated
    Steps:
      1. Grep AgentPanel.svelte for: spawnPty (IPC call present)
      2. Grep for: writePty (user input wired)
      3. Grep for: resizePty (resize wired)
      4. Grep for: killPty (abort wired)
      5. Grep for: pty-output (event listener present)
      6. Grep for: terminal.write (output rendered to xterm)
      7. Grep for: terminal.onData (input forwarded)
    Expected Result: All PTY operations wired in the component
    Failure Indicators: Missing IPC calls, missing event listeners
    Evidence: .sisyphus/evidence/task-10-wiring.txt

  Scenario: Abort handler includes PTY kill
    Tool: Bash
    Preconditions: AgentPanel.svelte updated
    Steps:
      1. Grep AgentPanel.svelte for handleAbort function
      2. Verify it calls killPty before abortImplementation
    Expected Result: Abort kills PTY then aborts session
    Failure Indicators: killPty missing from abort flow
    Evidence: .sisyphus/evidence/task-10-abort.txt
  ```

  **Evidence to Capture:**
  - [ ] task-10-integration-build.txt — full stack build output
  - [ ] task-10-wiring.txt — PTY wiring verification
  - [ ] task-10-abort.txt — abort flow verification

  **Commit**: YES
  - Message: `feat: integrate PTY terminal into start_implementation flow`
  - Files: `src-tauri/src/main.rs` (if needed), `src/components/AgentPanel.svelte`
  - Pre-commit: `cargo build && npm run build`

- [ ] 11. PTY Cleanup — Navigate-Away, Task Delete, App Exit

  **What to do**:
  - **Navigate-away**: In `AgentPanel.svelte`, in the `onDestroy` lifecycle:
    - Call `killPty(taskId)` to kill the PTY when user navigates back to Kanban board
    - Dispose the xterm.js Terminal instance
    - Clean up ResizeObserver
    - Note: when user comes back, loadSessionHistory + PTY spawn will re-attach
  - **Task delete**: In `src-tauri/src/main.rs`, in the `delete_task` command (or wherever tasks are deleted):
    - Call `pty_manager.kill_pty(task_id)` before deleting the task
    - This prevents orphaned `opencode attach` processes
  - **App exit**: In `src-tauri/src/main.rs`, in the app `setup()` or exit handler:
    - Call `pty_manager.kill_all()` to clean up all PTYs
    - Add to the existing server cleanup flow (where `server_manager.stop_all()` is called)
  - **PID file cleanup**: In `pty_manager.rs`, add a `cleanup_stale_pids()` method (same pattern as server_manager) called during app startup
  - **Verification**: After all cleanup paths, run `ps aux | grep "opencode attach"` to verify no orphans

  **Must NOT do**:
  - Do not keep PTYs alive in background when navigating away (too complex for V1)
  - Do not add complex session reconnection logic (just re-spawn on return)
  - Do not modify the server cleanup flow (add PTY cleanup alongside it, not replacing it)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple cleanup paths across frontend and backend — needs thoroughness to avoid orphan processes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 10)
  - **Blocks**: Task 12 (tests)
  - **Blocked By**: Task 7 (Tauri commands must exist)

  **References**:

  **Pattern References**:
  - `src/components/AgentPanel.svelte:106-110` — existing onDestroy handler (unlisten). Extend with PTY kill + terminal dispose
  - `src-tauri/src/server_manager.rs:190-203` — stop_all() pattern for cleaning up all managed resources
  - `src-tauri/src/server_manager.rs:215-254` — cleanup_stale_pids() pattern for startup cleanup
  - `src-tauri/src/main.rs` — Look for the app setup() function where server_manager cleanup is called on startup, and any exit/on_event handlers

  **WHY Each Reference Matters**:
  - AgentPanel onDestroy: This is THE cleanup point for navigate-away — must add PTY kill here
  - server_manager stop_all/cleanup: The exact pattern to replicate for PTY cleanup — ensures consistency

  **Acceptance Criteria**:
  - [ ] `cargo build` succeeds
  - [ ] `npm run build` succeeds
  - [ ] onDestroy calls killPty
  - [ ] App exit calls pty_manager.kill_all()
  - [ ] Task delete calls pty_manager.kill_pty()
  - [ ] cleanup_stale_pids() called on startup

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Navigate-away cleanup
    Tool: Bash
    Preconditions: AgentPanel.svelte has onDestroy handler
    Steps:
      1. Grep AgentPanel.svelte onDestroy for: killPty
      2. Grep for: terminal.*dispose or terminal.*destroy (xterm cleanup)
    Expected Result: PTY kill and terminal dispose in onDestroy
    Failure Indicators: Missing cleanup calls
    Evidence: .sisyphus/evidence/task-11-navigate-cleanup.txt

  Scenario: App exit cleanup
    Tool: Bash
    Preconditions: main.rs has exit handler
    Steps:
      1. Grep main.rs for: kill_all (PTY cleanup on exit)
      2. Grep main.rs for: cleanup_stale_pids (startup cleanup)
      3. Verify pty_manager cleanup is alongside server_manager cleanup
    Expected Result: PTY cleanup on both exit and startup
    Failure Indicators: Missing kill_all, missing cleanup_stale_pids
    Evidence: .sisyphus/evidence/task-11-app-cleanup.txt

  Scenario: No orphan processes after cleanup
    Tool: Bash
    Preconditions: All cleanup paths implemented
    Steps:
      1. Run: ps aux | grep "opencode attach" | grep -v grep | wc -l
      2. Verify count is 0
    Expected Result: Zero orphan opencode attach processes
    Failure Indicators: Non-zero count
    Evidence: .sisyphus/evidence/task-11-no-orphans.txt
  ```

  **Evidence to Capture:**
  - [ ] task-11-navigate-cleanup.txt — navigate-away cleanup verification
  - [ ] task-11-app-cleanup.txt — app exit cleanup verification
  - [ ] task-11-no-orphans.txt — orphan process check

  **Commit**: YES
  - Message: `feat(backend): add PTY cleanup on navigate-away and app exit`
  - Files: `src-tauri/src/pty_manager.rs`, `src-tauri/src/main.rs`, `src/components/AgentPanel.svelte`
  - Pre-commit: `cargo build && npm run build`

- [ ] 12. Add Tests for PTY Manager + Terminal Component

  **What to do**:
  - **Rust tests** — Add `#[cfg(test)] mod tests` to `pty_manager.rs`:
    - Test PtyError Display implementations
    - Test PtyManager::new() creates empty map
    - Test error conversions (if From impls exist)
    - Note: Can't easily test actual PTY spawning in CI (needs opencode installed), so focus on unit tests for the manager logic, error types, and method signatures
  - **Frontend tests** — Update or create `src/components/AgentPanel.test.ts`:
    - Test that the status bar renders correctly (status dot, stage label, abort button)
    - Test empty state rendering (no active session)
    - Mock xterm.js Terminal constructor (it requires canvas/DOM which jsdom doesn't fully support) — use `vi.mock('xterm')` to mock the Terminal class
    - Test that IPC functions are called on abort (mock killPty, abortImplementation)
    - DO NOT test terminal content (xterm.js renders to canvas, not testable with Testing Library)

  **Must NOT do**:
  - Do not rewrite existing passing tests
  - Do not add integration tests that require a running OpenCode server
  - Do not try to test xterm.js canvas rendering in jsdom

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Tests across Rust + TypeScript, mocking strategy for xterm.js, existing test patterns to follow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (sequential)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 10, 11 (all implementation must be done)

  **References**:

  **Pattern References**:
  - `src-tauri/src/server_manager.rs:337-357` — Rust test pattern: test error display, test manager creation
  - `src-tauri/src/opencode_client.rs:541-593` — More Rust test patterns: serialization, error variants
  - `src/components/Toast.test.ts` — Frontend test pattern: Testing Library + Vitest + component rendering
  - `src/__mocks__/@tauri-apps/api/` — Existing mock pattern for Tauri APIs

  **Test References**:
  - Existing tests show: `describe`, `it`, `expect`, `vi.mock`, `render`, `screen.getByText` patterns

  **WHY Each Reference Matters**:
  - server_manager.rs tests: The exact Rust test pattern to follow for pty_manager tests
  - Toast.test.ts: Shows how to test Svelte components with Testing Library in this project
  - __mocks__: Shows how Tauri APIs are mocked — need similar mocks for PTY IPC calls

  **Acceptance Criteria**:
  - [ ] `cargo test` passes (all tests including new ones)
  - [ ] `npm run test` passes (all tests including new ones)
  - [ ] At least 3 Rust tests for pty_manager
  - [ ] At least 3 frontend tests for AgentPanel terminal integration

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All tests pass
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Run: cargo test (from src-tauri/)
      2. Verify exit code 0, note test count
      3. Run: npm run test
      4. Verify exit code 0, note test count
    Expected Result: All tests pass, including new pty_manager and AgentPanel tests
    Failure Indicators: Test failures, missing test files
    Evidence: .sisyphus/evidence/task-12-test-results.txt

  Scenario: Rust pty_manager tests exist
    Tool: Bash
    Preconditions: pty_manager.rs has test module
    Steps:
      1. Grep pty_manager.rs for: #[cfg(test)]
      2. Grep for: #[test] (count occurrences)
      3. Verify at least 3 test functions
    Expected Result: Test module with 3+ tests
    Failure Indicators: No test module, fewer than 3 tests
    Evidence: .sisyphus/evidence/task-12-rust-tests.txt
  ```

  **Evidence to Capture:**
  - [ ] task-12-test-results.txt — full test output (cargo test + npm run test)
  - [ ] task-12-rust-tests.txt — rust test verification

  **Commit**: YES
  - Message: `test: add tests for PTY manager and terminal component`
  - Files: `src-tauri/src/pty_manager.rs`, `src/components/AgentPanel.test.ts`
  - Pre-commit: `cargo test && npm run test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cargo build && npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod (except existing debug logs), commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify `tokio::task::spawn_blocking` is used for PTY reader (NOT `tokio::spawn`).
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (start implementation → terminal renders → user types → abort → status updates). Test edge cases: navigate away and back, resize window, delete task with active PTY. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes. Verify `server_manager.rs`, `opencode_client.rs` are UNMODIFIED.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task(s) | Message | Key Files | Verification |
|------------|---------|-------|--------------|
| 2, 3 | `chore(deps): add portable-pty and xterm.js dependencies` | Cargo.toml, package.json | cargo build, npm install |
| 4 | `feat(backend): add PTY manager for terminal lifecycle` | pty_manager.rs | cargo build |
| 5, 6 | `feat(frontend): add xterm.js terminal component and IPC types` | AgentPanel.svelte, ipc.ts, types.ts | npm run build |
| 7 | `feat(backend): add Tauri commands for PTY spawn/write/resize/kill` | main.rs | cargo build |
| 8 | `refactor(backend): simplify SSE bridge to completion/error events only` | sse_bridge.rs | cargo build |
| 9 | `fix(frontend): update CSS overflow for terminal hosting` | TaskDetailView.svelte | npm run build |
| 10 | `feat: integrate PTY terminal into start_implementation flow` | main.rs, AgentPanel.svelte | cargo build, npm run build |
| 11 | `feat(backend): add PTY cleanup on navigate-away and app exit` | pty_manager.rs, main.rs | cargo test |
| 12 | `test: add tests for PTY manager and terminal component` | pty_manager.rs, AgentPanel.test.ts | cargo test, npm run test |

---

## Success Criteria

### Verification Commands
```bash
cargo build              # Expected: Compiles with no errors
npm run build            # Expected: Builds with no errors
cargo test               # Expected: All tests pass (including new pty_manager tests)
npm run test             # Expected: All tests pass (including new terminal tests)
ps aux | grep "opencode attach" | grep -v grep | wc -l  # Expected: 0 (after closing app)
```

### Final Checklist
- [ ] All "Must Have" present (TUI rendering, bidirectional I/O, resize, cleanup, env vars, UTF-8)
- [ ] All "Must NOT Have" absent (no xterm-svelte wrapper, no server_manager changes, no removed SSE bridge)
- [ ] All tests pass (cargo test + npm run test)
- [ ] No orphan processes after app exit
- [ ] OpenCode TUI renders with colors in the embedded terminal

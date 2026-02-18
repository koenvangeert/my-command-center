# Multi-Project + Git Worktree + OpenCode Agent Integration

## TL;DR

> **Quick Summary**: Transform the AI Command Center from a single-project app into a multi-project desktop app. Each project scopes its own tasks, JIRA, GitHub, and settings. Tasks get isolated git worktrees with per-worktree OpenCode servers using oh-my-opencode's native agent model. The 4-stage checkpoint orchestrator is replaced by a thin fire-and-forget coordinator with live SSE streaming.
> 
> **Deliverables**:
> - `projects` + `project_config` + `worktrees` tables in SQLite
> - Project switcher UI (like Slack workspaces)
> - `git_worktree.rs` module — repo scanning, worktree create/remove/prune
> - `server_manager.rs` module — per-worktree OpenCode server lifecycle (dynamic ports, PID tracking)
> - `sse_bridge.rs` module — multiplexed SSE streams (one per active task)
> - Expanded `opencode_client.rs` — `prompt_async`, `abort`, `list_agents`
> - `agent_coordinator.rs` — thin coordinator replacing 4-stage checkpoint orchestrator
> - Per-project JIRA sync and GitHub poller
> - All new frontend: ProjectSwitcher, ProjectSetup, RepoPickerDialog, AgentPanel (live SSE viewer)
> - Rewritten SettingsPanel (per-project), KanbanBoard, DetailPanel, App.svelte
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 5 waves + final verification
> **Critical Path**: T1 → T8 → T15 → T18 → F1-F4

---

## Context

### Original Request
User wants to evolve the AI Command Center into a multi-project desktop app that:
- Supports multiple git repositories as separate "projects" with a project switcher
- Uses git worktrees per task so agents work in isolation while users keep their main checkout clean
- Spawns one OpenCode server per active worktree on dynamic ports
- Replaces the 4-stage checkpoint orchestrator with oh-my-opencode's native agent model
- Shows live SSE event streaming from agents
- Makes all settings (JIRA, GitHub, OpenCode) per-project

### Interview Summary
**Key Discussions**:
- **Multi-project model**: Single DB with `projects` table. Project switcher in header. Tasks, config, sync all scoped to active project.
- **Settings model**: ALL per-project. Each project stores JIRA credentials, board ID, GitHub repo/token. No global settings (except task ID counter).
- **Git worktrees**: Created per-task at `~/.ai-command-center/worktrees/{repo-name}/{task-id}/`. Branch: `{task-id}/{slugified-title}`.
- **Server model**: One OpenCode server per active worktree. `--port 0` for dynamic port. Parse stdout for assigned port. PID files at `~/.ai-command-center/pids/{task-id}.pid`.
- **Task start flow**: Right-click → "Start Implementation" → repo picker dialog → worktree created → OpenCode spawned → prompt_async with task context → SSE streaming.
- **Agent model**: Replace orchestrator with thin coordinator. Send `prompt_async`, monitor SSE for `session.idle` (done) / `session.error` (failed). No checkpoints.
- **Worktree cleanup**: Auto on PR merge detected by github_poller.
- **Task IDs**: Keep T-N global auto-increment (globally unique, no per-project scoping needed).
- **No tests**: Ship the feature first.

**Research Findings**:
- **Git worktrees from Rust**: Shell out to `git` CLI. `git2-rs` does NOT support worktree operations. Use `git2` only for repo detection (`Repository::discover`).
- **SSE client**: `eventsource-client` v0.16+ (264K downloads/mo, Tokio-native, auto-reconnect). Production-proven by Arroyo, LaunchDarkly.
- **Process management**: `tokio::process::Command` with `kill_on_drop(true)`. Parse stdout with `BufReader::lines()` for port detection. Timeout with `tokio::time::timeout`.
- **SSE multiplexing**: `app.emit("agent-event", payload)` with `task_id` in payload. Frontend filters by active task. Simpler than per-label routing.
- **Branch safety**: After `git worktree add -b`, must `git branch --unset-upstream` to prevent accidental push to base branch.
- **Stale metadata**: 4-step cleanup: `git worktree remove --force` → delete `.git/worktrees/<name>` → `rm -rf` directory → `git worktree prune`.

### Metis Review
**Identified Gaps** (addressed):
- **SSE event routing**: Current `SseEventPayload` has no `task_id` — added to new `agent-event` payload.
- **What replaces checkpoints**: Fire-and-forget with SSE monitoring. No manual approval needed.
- **Resume existing worktree**: If task already has worktree+server, reconnect. If server dead, restart in existing worktree.
- **Branch checkout conflict**: Check if branch/worktree exists before creating. Reuse if present.
- **Unsafe upstream tracking**: Run `git branch --unset-upstream` after worktree creation.
- **Stale PID detection**: Validate PIDs on startup with `libc::kill(pid, 0)`. Use O_EXCL for atomic PID file creation.
- **Per-worktree-path locking**: Use `DashMap<String, Arc<tokio::sync::Mutex<()>>>` to prevent concurrent creation races.
- **Scope creep locks**: No agent picker UI (always use default Sisyphus). No multi-root-path. No repo cloning. No custom agent prompts. No worktree branch management UI. No Prometheus planning UI. No real-time file diff viewer.

---

## Work Objectives

### Core Objective
Add multi-project support, git worktree isolation, per-worktree OpenCode servers, and live SSE agent streaming to the AI Command Center — replacing the single-project, single-server, checkpoint-based architecture.

### Concrete Deliverables
- `projects`, `project_config`, `worktrees` tables in SQLite
- Project switcher dropdown in header
- Project setup dialog (name, repos root, optional JIRA/GitHub inline config)
- Repo picker dialog (select which repo for a task)
- Git worktree lifecycle management (create, remove, prune, scan)
- Per-worktree OpenCode server management (spawn, health, shutdown, PID tracking)
- Multiplexed SSE bridge (N concurrent streams, task-scoped events)
- Agent coordinator (prompt_async + SSE monitoring, replaces checkpoints)
- Live AgentPanel component (real-time agent output, abort button)
- Per-project SettingsPanel
- Per-project JIRA sync and GitHub polling
- Updated KanbanBoard, DetailPanel, App.svelte

### Definition of Done
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` succeeds
- [ ] `npm run build` succeeds
- [ ] Projects can be created with per-project settings
- [ ] Tasks scoped to active project
- [ ] Worktree created when starting implementation
- [ ] OpenCode server spawns on dynamic port in worktree directory
- [ ] SSE events stream into AgentPanel in real-time
- [ ] Worktree cleaned up on PR merge

### Must Have
- Multi-project with project switcher
- Per-project settings (JIRA, GitHub, repos root)
- Git worktree creation per-task with branch `{task-id}/{slug}`
- Per-worktree OpenCode server on dynamic port
- `prompt_async` for non-blocking agent dispatch
- Live SSE streaming to frontend with task-scoped events
- Agent abort capability
- Worktree cleanup on PR merge
- Repos root scanning for git repo discovery
- Repo picker dialog when starting implementation

### Must NOT Have (Guardrails)
- No agent picker UI in V1 — always uses default agent (Sisyphus)
- No custom agent prompts — use standard task context (title, description, acceptance criteria)
- No multi-root-path support — one repos root per project
- No repo cloning — only works with existing local repos
- No worktree branch management UI — branches are auto-created/deleted
- No Prometheus planning UI — oh-my-opencode handles this internally
- No real-time file diff viewer — use session diff endpoint later
- No drag-and-drop between columns (unchanged from decouple plan)
- No task deletion by end user (unchanged — use "Done" column)
- No manual checkpoint approve/reject — the old model is gone
- No global settings — everything is per-project (except `next_task_id`)
- No `git2-rs` for worktree operations — shell out to `git` CLI only
- No excessive comments, over-abstraction, or generic variable names
- No tests — ship the feature first

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest + cargo test)
- **Automated tests**: NO (user chose to skip tests for now)
- **Framework**: N/A

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Rust backend | Bash (cargo build) | Compile without errors |
| Frontend | Bash (npm run build) | Vite production build |
| New Rust modules | Bash (cargo build) | Compile + verify public API exists |
| UI components | Bash (npm run build) | TypeScript compilation |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 7 parallel, start immediately):
├── Task 1: DB schema evolution (projects, worktrees, migration) [deep]
├── Task 2: Frontend data layer (types, stores, ipc) [unspecified-high]
├── Task 3: git_worktree.rs module [deep]
├── Task 4: server_manager.rs module [deep]
├── Task 5: sse_bridge.rs module [unspecified-high]
├── Task 6: opencode_client.rs expansion [unspecified-high]
└── Task 7: Cargo.toml dependency updates [quick]

Wave 2 (Backend services + early UI — 7 parallel):
├── Task 8: agent_coordinator.rs (depends: 5, 6) [deep]
├── Task 9: jira_sync.rs per-project rewrite (depends: 1) [unspecified-high]
├── Task 10: github_poller.rs per-project + cleanup (depends: 1, 3) [unspecified-high]
├── Task 11: ProjectSwitcher + ProjectSetupDialog (depends: 2) [visual-engineering]
├── Task 12: RepoPickerDialog (depends: 2) [visual-engineering]
├── Task 13: AgentPanel component (depends: 2) [visual-engineering]
└── Task 14: SettingsPanel rewrite (depends: 2) [visual-engineering]

Wave 3 (Integration — 3 parallel):
├── Task 15: main.rs full rewrite (depends: 1, 3-6, 8-10) [deep]
├── Task 16: KanbanBoard update (depends: 2, 11, 12) [visual-engineering]
└── Task 17: DetailPanel update (depends: 2, 13) [visual-engineering]

Wave 4 (App wiring + cleanup — 2 parallel):
├── Task 18: App.svelte rewrite (depends: 2, 11-17) [deep]
└── Task 19: Cleanup — remove dead code + old modules (depends: 15) [quick]

Wave FINAL (Verification — 4 parallel):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real QA — full flow verification [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: T1 → T8 → T15 → T18 → F1-F4
Parallel Speedup: ~70% faster than sequential
Max Concurrent: 7 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | — | 8, 9, 10, 15 | 1 |
| 2 | — | 11, 12, 13, 14, 16, 17, 18 | 1 |
| 3 | — | 10, 15 | 1 |
| 4 | — | 15 | 1 |
| 5 | — | 8, 15 | 1 |
| 6 | — | 8, 15 | 1 |
| 7 | — | 8, 9, 10, 15 | 1 |
| 8 | 5, 6 | 15 | 2 |
| 9 | 1 | 15 | 2 |
| 10 | 1, 3 | 15 | 2 |
| 11 | 2 | 16, 18 | 2 |
| 12 | 2 | 16 | 2 |
| 13 | 2 | 17 | 2 |
| 14 | 2 | 18 | 2 |
| 15 | 1, 3-6, 8-10 | 18, 19 | 3 |
| 16 | 2, 11, 12 | 18 | 3 |
| 17 | 2, 13 | 18 | 3 |
| 18 | 2, 11-17 | F1-F4 | 4 |
| 19 | 15 | F1-F4 | 4 |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|----------------------|
| 1 | **7** | T1 → `deep`, T2 → `unspecified-high`, T3 → `deep`, T4 → `deep`, T5 → `unspecified-high`, T6 → `unspecified-high`, T7 → `quick` |
| 2 | **7** | T8 → `deep`, T9 → `unspecified-high`, T10 → `unspecified-high`, T11 → `visual-engineering`, T12 → `visual-engineering`, T13 → `visual-engineering`, T14 → `visual-engineering` |
| 3 | **3** | T15 → `deep`, T16 → `visual-engineering`, T17 → `visual-engineering` |
| 4 | **2** | T18 → `deep`, T19 → `quick` |
| FINAL | **4** | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [ ] 1. DB Schema Evolution

  **What to do**:
  - Add `projects` table: `id TEXT PRIMARY KEY, name TEXT NOT NULL, repos_root_path TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL`. ID format: auto-increment `P-{n}` using a new `next_project_id` counter in config table.
  - Add `project_config` table: `project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, key TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(project_id, key)`.
  - Add `worktrees` table: `id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id), project_id TEXT NOT NULL REFERENCES projects(id), repo_path TEXT NOT NULL, worktree_path TEXT NOT NULL, branch_name TEXT NOT NULL, opencode_port INTEGER, opencode_pid INTEGER, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL`.
  - Add `project_id TEXT REFERENCES projects(id)` column to existing `tasks` table. Nullable for migration (existing tasks get NULL project_id).
  - Migration logic in `run_migrations()`: detect missing `projects` table → CREATE all new tables → ALTER tasks ADD COLUMN project_id → seed `next_project_id` config key.
  - New DB methods:
    - `create_project(name, repos_root_path) -> Result<ProjectRow>`: auto-increment P-N ID
    - `get_all_projects() -> Result<Vec<ProjectRow>>`
    - `get_project(id) -> Result<Option<ProjectRow>>`
    - `update_project(id, name, repos_root_path) -> Result<()>`
    - `delete_project(id) -> Result<()>`: CASCADE deletes project_config rows
    - `get_project_config(project_id, key) -> Result<Option<String>>`
    - `set_project_config(project_id, key, value) -> Result<()>`: UPSERT
    - `get_all_project_config(project_id) -> Result<HashMap<String, String>>`
    - `create_worktree_record(task_id, project_id, repo_path, worktree_path, branch_name) -> Result<i64>`
    - `get_worktree_for_task(task_id) -> Result<Option<WorktreeRow>>`
    - `update_worktree_server(task_id, port, pid) -> Result<()>`
    - `update_worktree_status(task_id, status) -> Result<()>`
    - `delete_worktree_record(task_id) -> Result<()>`
    - `get_active_worktrees() -> Result<Vec<WorktreeRow>>`
    - `get_tasks_for_project(project_id) -> Result<Vec<TaskRow>>`
    - `create_task` updated: accept optional `project_id` parameter
  - Add new structs: `ProjectRow { id, name, repos_root_path, created_at, updated_at }`, `WorktreeRow { id, task_id, project_id, repo_path, worktree_path, branch_name, opencode_port, opencode_pid, status, created_at, updated_at }`

  **Must NOT do**:
  - Don't change existing TaskRow fields (they're correct from decouple-jira)
  - Don't make project_id NOT NULL on tasks (breaks existing data)
  - Don't add project_id to agent_sessions or pull_requests (they FK to tasks which carries project context)
  - Don't remove the global config table (still needed for next_task_id, next_project_id)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Substantial schema evolution with migration logic, 15+ new methods, 3 new tables, FK handling
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `golang`: Not applicable — Rust

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Tasks 8, 9, 10, 15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/src/db.rs:79-100` — `Database::new()` and initialization pattern
  - `src-tauri/src/db.rs:103-244` — `run_migrations()`: ADD to this method (don't replace — it already handles post-decouple schema)
  - `src-tauri/src/db.rs:246-265` — `get_config/set_config`: Follow this pattern for `get_project_config/set_project_config`
  - `src-tauri/src/db.rs:268-329` — `create_task`: Follow for `create_project` (auto-increment ID pattern using config counter)
  - `src-tauri/src/db.rs:7-20` — `TaskRow` struct: Follow for `ProjectRow` and `WorktreeRow`

  **WHY Each Reference Matters**:
  - `run_migrations` is the function to EXTEND — must detect if new tables already exist before creating
  - `create_task` shows the auto-increment ID pattern (read counter from config, format ID, increment) — reuse for projects
  - `get_config/set_config` pattern is reused for project-scoped config with `(project_id, key)` composite

  **Acceptance Criteria**:
  - [ ] `projects`, `project_config`, `worktrees` tables created by migration
  - [ ] `tasks.project_id` column exists (nullable)
  - [ ] `ProjectRow` and `WorktreeRow` structs exist
  - [ ] `create_project` generates P-1, P-2, P-3 IDs
  - [ ] `get_tasks_for_project` filters by project_id
  - [ ] `create_worktree_record` / `get_worktree_for_task` round-trip works
  - [ ] `get_project_config` / `set_project_config` UPSERT works
  - [ ] `cargo build` succeeds in src-tauri/

  **QA Scenarios**:

  ```
  Scenario: Schema migration adds new tables
    Tool: Bash (cargo build)
    Preconditions: Existing database from decouple-jira
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. Verify: no compilation errors
    Expected Result: Clean build with new structs and methods
    Failure Indicators: Compilation errors, missing types
    Evidence: .sisyphus/evidence/task-1-cargo-build.txt

  Scenario: Verify new tables exist in migration
    Tool: Bash (grep)
    Steps:
      1. grep -n "CREATE TABLE.*projects" src-tauri/src/db.rs
      2. grep -n "CREATE TABLE.*project_config" src-tauri/src/db.rs
      3. grep -n "CREATE TABLE.*worktrees" src-tauri/src/db.rs
      4. grep -n "ALTER TABLE.*project_id" src-tauri/src/db.rs
    Expected Result: All 4 schema statements found
    Evidence: .sisyphus/evidence/task-1-schema-check.txt
  ```

  **Commit**: YES
  - Message: `feat(db): add projects, project_config, and worktrees tables`
  - Files: `src-tauri/src/db.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 2. Frontend Data Layer Update

  **What to do**:
  - **types.ts**: Add `Project` interface: `{ id: string; name: string; repos_root_path: string; created_at: number; updated_at: number }`. Add `WorktreeInfo` interface: `{ id: number; task_id: string; project_id: string; repo_path: string; worktree_path: string; branch_name: string; opencode_port: number | null; opencode_pid: number | null; status: string; created_at: number; updated_at: number }`. Add `RepoInfo` interface: `{ name: string; path: string }`. Add `AgentEvent` interface (replaces `OpenCodeEvent`): `{ task_id: string; event_type: string; data: string; timestamp: number }`. Add `ImplementationStatus` interface: `{ task_id: string; worktree_path: string; port: number; session_id: string }`. Add `project_id: string | null` to existing `Task` interface.
  - **stores.ts**: Add `projects` store: `writable<Project[]>([])`. Add `activeProjectId` store: `writable<string | null>(null)`. Add `agentEvents` store: `writable<Map<string, AgentEvent[]>>(new Map())` — keyed by task_id. Keep all existing stores.
  - **ipc.ts**: Add project functions:
    - `createProject(name, reposRootPath): Promise<Project>`
    - `getProjects(): Promise<Project[]>`
    - `updateProject(id, name, reposRootPath): Promise<void>`
    - `deleteProject(id): Promise<void>`
    - `getProjectConfig(projectId, key): Promise<string | null>`
    - `setProjectConfig(projectId, key, value): Promise<void>`
    - `scanRepos(reposRootPath): Promise<RepoInfo[]>`
    - `getTasksForProject(projectId): Promise<Task[]>`
  - Add worktree/implementation functions:
    - `startImplementation(taskId, repoPath): Promise<ImplementationStatus>`
    - `abortImplementation(taskId): Promise<void>`
    - `getWorktreeForTask(taskId): Promise<WorktreeInfo | null>`
  - Remove: `startTicketImplementation` (replaced by `startImplementation`)
  - Remove: `approveCheckpoint`, `rejectCheckpoint` (checkpoints gone)
  - Remove: `addressSelectedPrComments` (old orchestrator flow)
  - Keep all other existing functions

  **Must NOT do**:
  - Don't change PullRequestInfo, AgentSession, AgentLog, PrComment types
  - Don't remove stores that other components still use
  - Don't add per-project store filtering yet (that's App.svelte's job in T18)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Substantial additions across 3 tightly-coupled files with new interfaces, stores, and IPC functions
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Tasks 11, 12, 13, 14, 16, 17, 18
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/types.ts:1-13` — `Task` interface: add `project_id` field, follow pattern for new interfaces
  - `src/lib/types.ts:59-68` — `OpenCodeStatus` and `OpenCodeEvent`: model for new `AgentEvent` interface
  - `src/lib/stores.ts:1-12` — All stores: follow pattern for new stores
  - `src/lib/ipc.ts:4-6` — `createTask` pattern: follow for `createProject`, `startImplementation`
  - `src/lib/ipc.ts:84-90` — `getConfig/setConfig`: follow for `getProjectConfig/setProjectConfig`

  **Acceptance Criteria**:
  - [ ] `Project`, `WorktreeInfo`, `RepoInfo`, `AgentEvent`, `ImplementationStatus` interfaces exist
  - [ ] `Task` has `project_id: string | null`
  - [ ] `projects`, `activeProjectId`, `agentEvents` stores exist
  - [ ] `createProject`, `getProjects`, `scanRepos`, `startImplementation`, `abortImplementation` IPC functions exist
  - [ ] `startTicketImplementation`, `approveCheckpoint`, `rejectCheckpoint`, `addressSelectedPrComments` removed
  - [ ] TypeScript: no errors in these 3 files (`npx tsc --noEmit` on types/stores/ipc)

  **QA Scenarios**:

  ```
  Scenario: Data layer files compile
    Tool: Bash
    Steps:
      1. Run: npx tsc --noEmit --pretty 2>&1 | head -50
      2. Check types.ts, stores.ts, ipc.ts have no errors
    Expected Result: No type errors in data layer files
    Evidence: .sisyphus/evidence/task-2-types-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(frontend): add project, worktree, and agent event types`
  - Files: `src/lib/types.ts`, `src/lib/stores.ts`, `src/lib/ipc.ts`

---

- [ ] 3. Git Worktree Module

  **What to do**:
  - Create `src-tauri/src/git_worktree.rs`. Add `mod git_worktree;` to main.rs module declarations.
  - Implement repo scanning:
    - `pub fn scan_repos(root: &Path) -> Result<Vec<RepoInfo>, GitWorktreeError>`: Read subdirectories, use `git2::Repository::discover()` on each to detect git repos. Return `RepoInfo { name: String, path: PathBuf }`.
  - Implement worktree creation with safety:
    - `pub async fn create_worktree(repo_path: &Path, worktree_path: &Path, branch_name: &str, base_ref: &str) -> Result<(), GitWorktreeError>`:
      1. Acquire per-path lock using `DashMap<String, Arc<tokio::sync::Mutex<()>>>`
      2. Run `git worktree prune` first (clean stale metadata)
      3. Check if worktree_path already exists → if yes, return Ok (reuse)
      4. Run `git worktree add -b {branch_name} {worktree_path} {base_ref}`
      5. Run `git -C {worktree_path} branch --unset-upstream` (prevent accidental push to base)
      6. On failure: run 4-step cleanup (remove --force → delete metadata → rm -rf → prune), retry once
  - Implement worktree removal:
    - `pub async fn remove_worktree(repo_path: &Path, worktree_path: &Path) -> Result<(), GitWorktreeError>`: 4-step cleanup sequence
  - Implement listing:
    - `pub async fn list_worktrees(repo_path: &Path) -> Result<Vec<WorktreeListEntry>, GitWorktreeError>`: Parse `git worktree list --porcelain`
  - Utility:
    - `pub fn slugify_branch_name(task_id: &str, title: &str) -> String`: Generate `T-5/add-auth-module` from task ID + title. Lowercase, replace spaces/special with hyphens, truncate to 60 chars.
  - Error type: `GitWorktreeError` enum with variants: NotARepository, WorktreeAddFailed(String), WorktreeRemoveFailed(String), CommandFailed(String), IoError(std::io::Error)
  - Per-path locking: Use `once_cell::sync::Lazy<DashMap<String, Arc<tokio::sync::Mutex<()>>>>` for thread-safe per-worktree locks

  **Must NOT do**:
  - Don't use `git2-rs` for ANY worktree operations (it doesn't support them)
  - Don't clone repos — only work with existing local repos
  - Don't manage branches beyond creation and upstream unsetting
  - Don't implement git push/pull/fetch

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: New module with async subprocess management, locking strategy, retry logic, and error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4-7)
  - **Blocks**: Tasks 10, 15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/src/opencode_manager.rs:47-77` — `start()` method: Shell out to external command with `tokio::process::Command`, capture output. Same pattern for `git worktree add`.
  - `src-tauri/src/opencode_manager.rs:14-37` — Error enum pattern: Follow for `GitWorktreeError`

  **External References**:
  - `git2::Repository::discover()` docs: https://docs.rs/git2/latest/git2/struct.Repository.html#method.discover — for repo detection
  - `git worktree` man page: https://git-scm.com/docs/git-worktree — CLI reference

  **Acceptance Criteria**:
  - [ ] `scan_repos` detects git repos in a directory (returns Vec<RepoInfo>)
  - [ ] `create_worktree` creates a worktree with correct branch name
  - [ ] `create_worktree` runs `git branch --unset-upstream` after creation
  - [ ] `remove_worktree` performs 4-step cleanup
  - [ ] `slugify_branch_name("T-5", "Add Auth Module")` returns `"T-5/add-auth-module"`
  - [ ] Per-path locking prevents concurrent creation for same path
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Module compiles with public API
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. grep -n "pub fn scan_repos\|pub async fn create_worktree\|pub async fn remove_worktree\|pub fn slugify_branch_name" src-tauri/src/git_worktree.rs
    Expected Result: Build succeeds, all 4 public functions exist
    Evidence: .sisyphus/evidence/task-3-git-worktree.txt

  Scenario: Branch name slugification
    Tool: Bash (grep)
    Steps:
      1. grep -A5 "slugify_branch_name" src-tauri/src/git_worktree.rs
      2. Verify function handles: spaces→hyphens, uppercase→lowercase, special chars removed, max 60 chars
    Expected Result: Correct slugification logic present
    Evidence: .sisyphus/evidence/task-3-slugify.txt
  ```

  **Commit**: YES
  - Message: `feat(git): add git worktree management module`
  - Files: `src-tauri/src/git_worktree.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 4. Server Manager Module

  **What to do**:
  - Create `src-tauri/src/server_manager.rs`. Add `mod server_manager;` to main.rs module declarations.
  - This REPLACES `opencode_manager.rs` conceptually (old file removed in T19).
  - Implement `ServerManager` struct managing multiple OpenCode servers:
    - Internal state: `servers: Arc<tokio::sync::Mutex<HashMap<String, ManagedServer>>>` keyed by task_id
    - `ManagedServer { child: tokio::process::Child, port: u16, pid: u32, worktree_path: PathBuf }`
  - Methods:
    - `pub fn new() -> Self`
    - `pub async fn spawn_server(&self, task_id: &str, worktree_path: &Path) -> Result<u16, ServerError>`:
      1. Check if server already running for this task_id → return existing port
      2. Spawn: `Command::new("opencode").arg("serve").arg("--port").arg("0").current_dir(worktree_path).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true)`
      3. Parse stdout with `BufReader::lines()` for `"opencode server listening on http://127.0.0.1:<PORT>"` — extract port via regex
      4. Wrap in `tokio::time::timeout(Duration::from_secs(30), ...)` for safety
      5. Wait for health check at parsed port
      6. Write PID file to `~/.ai-command-center/pids/{task_id}.pid` using `File::create_new()` (O_EXCL)
      7. Store in HashMap, return port
    - `pub async fn stop_server(&self, task_id: &str) -> Result<(), ServerError>`:
      1. Remove from HashMap
      2. Send SIGTERM, wait with timeout, force kill if needed
      3. `.wait()` to reap zombie
      4. Delete PID file
    - `pub async fn stop_all(&self) -> Result<(), ServerError>`: Stop all managed servers
    - `pub fn get_server_port(&self, task_id: &str) -> Option<u16>`: Lookup port for task
    - `pub async fn cleanup_stale_pids(&self)`: On startup, scan `~/.ai-command-center/pids/`, check each PID with `libc::kill(pid, 0)`, remove stale PID files
  - Error type: `ServerError` with variants: SpawnFailed, PortDetectionTimeout, HealthCheckFailed, ProcessNotFound, IoError
  - Home directory: `dirs::home_dir().unwrap().join(".ai-command-center")`

  **Must NOT do**:
  - Don't use fixed ports — always `--port 0`
  - Don't block on server startup (use async throughout)
  - Don't leave zombie processes (always `.wait()` after kill)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex async process management with port detection, PID tracking, graceful shutdown, and concurrent access
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: Task 15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/src/opencode_manager.rs:40-77` — Current `OpenCodeManager::start()`: Same spawn + health check pattern, but needs dynamic port parsing instead of hardcoded 4096
  - `src-tauri/src/opencode_manager.rs:114-152` — `shutdown()`: SIGTERM + timeout + force kill pattern — reuse for per-server shutdown

  **External References**:
  - `tokio::process::Command` docs: https://docs.rs/tokio/latest/tokio/process/struct.Command.html
  - `dirs::home_dir()` docs: https://docs.rs/dirs/latest/dirs/fn.home_dir.html

  **Acceptance Criteria**:
  - [ ] `ServerManager` manages multiple servers in a HashMap
  - [ ] `spawn_server` uses `--port 0` and parses stdout for port
  - [ ] `spawn_server` returns existing port if server already running for task_id
  - [ ] `stop_server` sends SIGTERM, waits, force kills, reaps zombie, removes PID file
  - [ ] `cleanup_stale_pids` validates PIDs on startup
  - [ ] PID files at `~/.ai-command-center/pids/{task_id}.pid`
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Server manager compiles with full API
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. grep -n "pub async fn spawn_server\|pub async fn stop_server\|pub async fn stop_all\|pub async fn cleanup_stale_pids" src-tauri/src/server_manager.rs
    Expected Result: Build succeeds, all public methods exist
    Evidence: .sisyphus/evidence/task-4-server-manager.txt
  ```

  **Commit**: YES
  - Message: `feat(server): add per-worktree OpenCode server manager`
  - Files: `src-tauri/src/server_manager.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 5. SSE Bridge Module

  **What to do**:
  - Create `src-tauri/src/sse_bridge.rs`. Add `mod sse_bridge;` to main.rs module declarations.
  - This REPLACES the inline `start_sse_bridge` function in main.rs (that code removed in T15/T19).
  - Implement `SseBridgeManager` managing multiple SSE connections:
    - Internal state: `bridges: Arc<tokio::sync::Mutex<HashMap<String, BridgeHandle>>>` keyed by task_id
    - `BridgeHandle { cancel_tx: tokio::sync::oneshot::Sender<()> }`
  - Methods:
    - `pub fn new() -> Self`
    - `pub async fn start_bridge(&self, app: AppHandle, task_id: String, server_port: u16) -> Result<(), SseBridgeError>`:
      1. Build SSE URL: `format!("http://127.0.0.1:{}/event", server_port)`
      2. Create `eventsource_client::ClientBuilder::for_url()` with reconnect options (delay 500ms, backoff 2x, max 30s)
      3. Spawn tokio task that:
         a. Streams events via `client.stream()`
         b. On `SSE::Event(evt)`: emit `app.emit("agent-event", AgentEventPayload { task_id, event_type: evt.event_type, data: evt.data, timestamp })` to frontend
         c. On `session.idle` event: also emit `app.emit("implementation-complete", { task_id })`
         d. On `session.error` event: also emit `app.emit("implementation-failed", { task_id, error })`
         e. Uses `tokio::select!` with cancellation channel
      4. Store BridgeHandle
    - `pub async fn stop_bridge(&self, task_id: &str)`: Send cancel signal, remove from map
    - `pub async fn stop_all(&self)`: Cancel all bridges
  - Payload struct (pub): `AgentEventPayload { task_id: String, event_type: String, data: String, timestamp: u64 }`
  - Use `eventsource_client` crate (added in T7)

  **Must NOT do**:
  - Don't use the old raw byte-stream parsing from current main.rs SSE bridge — use eventsource_client's typed SSE enum
  - Don't emit events without task_id (every event must be task-scoped)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New module using external SSE crate, async stream processing, Tauri event emission, cancellation pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6, 7)
  - **Blocks**: Tasks 8, 15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/src/main.rs:563-625` — Current `start_sse_bridge()`: Inline SSE parsing. This is what we're REPLACING with proper eventsource_client. Understand the event emission pattern (`app.emit`) to match.
  - `src-tauri/src/main.rs:555-561` — `SseEventPayload` struct: Our new `AgentEventPayload` extends this with `task_id` and `timestamp`

  **External References**:
  - `eventsource_client` docs: https://docs.rs/eventsource-client/latest/ — ClientBuilder, SSE enum, reconnect options
  - OpenCode SSE events: `message.part.delta`, `message.updated`, `session.status`, `session.error`, `session.idle`, `permission.asked`, `question.asked`

  **Acceptance Criteria**:
  - [ ] `SseBridgeManager` manages multiple concurrent SSE connections
  - [ ] `start_bridge` connects to OpenCode SSE endpoint and streams events
  - [ ] Events emitted to frontend include `task_id` field
  - [ ] `session.idle` triggers `implementation-complete` event
  - [ ] `session.error` triggers `implementation-failed` event
  - [ ] `stop_bridge` cleanly cancels the stream
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: SSE bridge module compiles
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. grep -n "pub async fn start_bridge\|pub async fn stop_bridge\|pub async fn stop_all\|AgentEventPayload" src-tauri/src/sse_bridge.rs
    Expected Result: Build succeeds, public API exists
    Evidence: .sisyphus/evidence/task-5-sse-bridge.txt
  ```

  **Commit**: YES
  - Message: `feat(sse): add multiplexed SSE bridge for per-task event streaming`
  - Files: `src-tauri/src/sse_bridge.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 6. OpenCode Client Expansion

  **What to do**:
  - Expand `src-tauri/src/opencode_client.rs` with new methods:
    - `pub async fn prompt_async(&self, session_id: &str, text: String, agent: Option<String>) -> Result<(), OpenCodeError>`: POST to `/session/{id}/prompt_async` with `PromptAsyncRequest { parts, agent }`. Fire-and-forget (no response body needed).
    - `pub async fn abort_session(&self, session_id: &str) -> Result<(), OpenCodeError>`: POST to `/session/{id}/abort`.
    - `pub async fn list_agents(&self) -> Result<Vec<AgentInfo>, OpenCodeError>`: GET `/agent`. Returns available agents.
    - `pub async fn get_session(&self, session_id: &str) -> Result<SessionInfo, OpenCodeError>`: GET `/session/{id}`. Returns session details.
  - Add new request/response types:
    - `PromptAsyncRequest { parts: Vec<Part>, #[serde(skip_serializing_if = "Option::is_none")] agent: Option<String> }`
    - `AgentInfo { name: String, #[serde(flatten)] extra: serde_json::Map<String, serde_json::Value> }`
    - `SessionInfo { id: String, status: String, #[serde(flatten)] extra: serde_json::Map<String, serde_json::Value> }`
  - Keep ALL existing methods (create_session, send_prompt, subscribe_events, health)
  - Note: `subscribe_events` becomes less important (sse_bridge uses eventsource_client directly), but keep it for backward compatibility

  **Must NOT do**:
  - Don't change existing method signatures
  - Don't change the Client/base_url architecture (with_base_url already supports per-server URLs)
  - Don't remove any existing types

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Moderate expansion — 4 new methods, 3 new types, following existing patterns exactly
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: Tasks 8, 15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/src/opencode_client.rs:65-95` — `create_session()`: Follow exact same POST pattern for `prompt_async` and `abort_session`
  - `src-tauri/src/opencode_client.rs:115-154` — `send_prompt()`: Similar to `prompt_async` but without waiting for response
  - `src-tauri/src/opencode_client.rs:257-290` — Request/response types: Follow `#[serde(flatten)] extra` pattern for new types
  - `src-tauri/src/opencode_client.rs:296-305` — `OpenCodeError` enum: Reuse for new methods

  **External References**:
  - OpenCode serve API: POST `/session/{id}/prompt_async`, POST `/session/{id}/abort`, GET `/agent`, GET `/session/{id}`

  **Acceptance Criteria**:
  - [ ] `prompt_async` sends POST with optional `agent` field
  - [ ] `abort_session` sends POST to abort endpoint
  - [ ] `list_agents` returns available agents
  - [ ] `get_session` returns session info
  - [ ] All existing methods unchanged
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Expanded client compiles
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. grep -n "pub async fn prompt_async\|pub async fn abort_session\|pub async fn list_agents\|pub async fn get_session" src-tauri/src/opencode_client.rs
    Expected Result: Build succeeds, 4 new methods exist alongside original 4
    Evidence: .sisyphus/evidence/task-6-client-expansion.txt
  ```

  **Commit**: YES
  - Message: `feat(opencode): add prompt_async, abort, agents, and session info endpoints`
  - Files: `src-tauri/src/opencode_client.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 7. Cargo.toml Dependency Updates

  **What to do**:
  - Add new dependencies to `src-tauri/Cargo.toml`:
    - `eventsource-client = "0.16"` — SSE client for sse_bridge.rs
    - `git2 = { version = "0.19", default-features = false }` — repo detection only (no SSH/HTTPS features needed)
    - `futures = "0.3"` — TryStreamExt for eventsource-client stream processing
    - `dashmap = "6"` — concurrent HashMap for per-path locking in git_worktree.rs
    - `dirs = "6"` — cross-platform home directory for `~/.ai-command-center/`
    - `once_cell = "1"` — Lazy static for global lock map
    - `regex = "1"` — port parsing from stdout, branch name sanitization
    - `libc = "0.2"` — PID validation with kill(pid, 0)
  - Keep ALL existing dependencies unchanged

  **Must NOT do**:
  - Don't change any existing dependency versions
  - Don't add unnecessary features to git2 (keep default-features = false)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file edit — add lines to dependencies section
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: Tasks 8, 9, 10, 15 (indirectly — other tasks need these deps to compile)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src-tauri/Cargo.toml:12-26` — Current `[dependencies]` section: add new entries at the end

  **Acceptance Criteria**:
  - [ ] All 8 new dependencies listed in Cargo.toml
  - [ ] Existing dependencies unchanged
  - [ ] `cargo build` succeeds (dependencies resolve)

  **QA Scenarios**:

  ```
  Scenario: Dependencies resolve
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
    Expected Result: Clean build, no dependency resolution errors
    Evidence: .sisyphus/evidence/task-7-deps.txt
  ```

  **Commit**: YES
  - Message: `build(deps): add git2, eventsource-client, dashmap, and utility crates`
  - Files: `src-tauri/Cargo.toml`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 8. Agent Coordinator Module

  **What to do**:
  - Create `src-tauri/src/agent_coordinator.rs`. Add `mod agent_coordinator;` to main.rs module declarations.
  - This REPLACES `orchestrator.rs` (old file removed in T19).
  - The coordinator is a THIN layer — no stages, no checkpoints. It orchestrates: create session → send prompt_async → let SSE bridge handle events.
  - Implement `AgentCoordinator` struct:
    - Dependencies: needs access to `OpenCodeClient` (created per-server with specific base_url)
  - Methods:
    - `pub async fn start_implementation(db: &Database, app: &AppHandle, task_id: &str, server_port: u16) -> Result<String, CoordinatorError>`:
      1. Get task from DB: `db.get_task(task_id)`
      2. Create OpenCodeClient for this server: `OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", server_port))`
      3. Create session: `client.create_session(format!("Task {}", task_id))`
      4. Build prompt with task context: title, description, acceptance criteria (if set)
      5. Send via `client.prompt_async(session_id, prompt, None)` (default agent)
      6. Create agent_session in DB: `db.create_agent_session(session_id, task_id, opencode_session_id, "implementing", "running")`
      7. Return session_id
    - `pub async fn abort_implementation(db: &Database, app: &AppHandle, task_id: &str, server_port: u16) -> Result<(), CoordinatorError>`:
      1. Get latest session for task
      2. Create client for server port
      3. Call `client.abort_session(opencode_session_id)`
      4. Update session status to "failed"
      5. Emit `session-aborted` event
    - `pub async fn handle_implementation_complete(db: &Database, app: &AppHandle, task_id: &str) -> Result<(), CoordinatorError>`:
      1. Update agent session status to "completed"
      2. Emit `implementation-complete` event (already emitted by SSE bridge, but update DB here)
    - `pub async fn handle_implementation_failed(db: &Database, app: &AppHandle, task_id: &str, error: &str) -> Result<(), CoordinatorError>`:
      1. Update agent session status to "failed" with error_message
  - Error type: `CoordinatorError` with variants: TaskNotFound, SessionCreationFailed, PromptFailed, AbortFailed
  - Prompt template:
    ```
    You are working on task {task_id}: {title}

    {description if not empty}

    {acceptance_criteria if not empty, prefixed with "Acceptance Criteria:"}

    Implement this task. Create a branch, make the changes, and create a pull request when done.
    ```

  **Must NOT do**:
  - Don't implement stages or checkpoints — this is fire-and-forget
  - Don't implement custom agent selection (always default agent for V1)
  - Don't wait for prompt_async to complete (it's non-blocking by design)
  - Don't implement the full orchestration flow from oh-my-opencode (Prometheus→Atlas→Junior) — let OpenCode handle that internally

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core business logic — session lifecycle, prompt construction, error handling, DB coordination
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-14)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src-tauri/src/orchestrator.rs:49-142` — `start_implementation()`: Shows the current session creation + prompt sending flow. The NEW version is much simpler (no stages, no checkpoints).
  - `src-tauri/src/orchestrator.rs:500-512` — `get_session_status()`: Keep similar DB lookup pattern
  - `src-tauri/src/orchestrator.rs:514-543` — `abort_session()`: Similar abort flow but calls client.abort_session instead of just DB update
  - `src-tauri/src/opencode_client.rs:65-95` — `create_session()`: Used to create the OpenCode session
  - `src-tauri/src/opencode_client.rs` — New `prompt_async()` method (from T6): Used to send the non-blocking prompt

  **Acceptance Criteria**:
  - [ ] `start_implementation` creates session, sends prompt_async, returns session_id
  - [ ] `abort_implementation` calls OpenCode abort endpoint and updates DB
  - [ ] `handle_implementation_complete` and `handle_implementation_failed` update DB
  - [ ] Prompt includes task title, description, and acceptance criteria
  - [ ] No checkpoint or stage logic
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Agent coordinator compiles
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
      2. grep -n "pub async fn start_implementation\|pub async fn abort_implementation\|pub async fn handle_implementation" src-tauri/src/agent_coordinator.rs
    Expected Result: Build succeeds, all methods exist
    Evidence: .sisyphus/evidence/task-8-coordinator.txt

  Scenario: No checkpoint/stage logic
    Tool: Bash (grep)
    Steps:
      1. grep -in "checkpoint\|approve\|reject\|read_ticket\|create_pr\|address_comments" src-tauri/src/agent_coordinator.rs
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-8-no-checkpoints.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add thin agent coordinator replacing checkpoint orchestrator`
  - Files: `src-tauri/src/agent_coordinator.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 9. JIRA Sync Per-Project Rewrite

  **What to do**:
  - Rewrite `start_jira_sync()` in `jira_sync.rs` to iterate all projects:
    1. Get all projects: `db.get_all_projects()`
    2. For each project:
       a. Read project JIRA config: `db.get_project_config(project_id, "jira_api_token")`, etc.
       b. If any JIRA config missing (no base_url or no token), skip this project
       c. Get linked tasks for project: filter `get_tasks_with_jira_links()` by project_id (or add new method `get_project_tasks_with_jira_links(project_id)`)
       d. Build JQL and sync as before
    3. Sleep and repeat
  - Update `SyncConfig` to include `project_id`
  - The `read_sync_config` helper now reads from `project_config` table instead of global `config` table
  - Keep the `jira-sync-complete` event emission
  - If no projects exist, sleep and retry (first-run scenario)

  **Must NOT do**:
  - Don't create tasks from JIRA (unchanged from decouple)
  - Don't write back to JIRA (unchanged)
  - Don't sync projects without JIRA config — just skip them silently

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Moderate rewrite — add project iteration loop, change config source from global to per-project
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-14)
  - **Blocks**: Task 15
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src-tauri/src/jira_sync.rs:40-117` — Current `start_jira_sync()`: Wrap existing logic in a per-project loop
  - `src-tauri/src/jira_sync.rs:143-149` — `SyncConfig`: Add project_id field, change source to project_config
  - `src-tauri/src/db.rs` — New `get_project_config()` method (from T1)

  **Acceptance Criteria**:
  - [ ] Sync iterates all projects
  - [ ] Each project uses its own JIRA credentials from project_config
  - [ ] Projects without JIRA config are silently skipped
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Per-project sync logic
    Tool: Bash (grep)
    Steps:
      1. grep -n "get_all_projects\|get_project_config\|project_id" src-tauri/src/jira_sync.rs
    Expected Result: Project iteration and per-project config reads present
    Evidence: .sisyphus/evidence/task-9-jira-per-project.txt
  ```

  **Commit**: YES
  - Message: `refactor(jira-sync): scope JIRA sync to per-project config`
  - Files: `src-tauri/src/jira_sync.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 10. GitHub Poller Per-Project + Worktree Cleanup

  **What to do**:
  - Rewrite `start_github_poller()` in `github_poller.rs` to iterate all projects:
    1. Get all projects
    2. For each project: read GitHub config from project_config (token, default_repo)
    3. If GitHub config missing, skip project
    4. Poll PRs for that project's repo
    5. Match PRs to tasks within that project
  - Add worktree cleanup trigger on PR merge:
    1. When `sync_open_prs` detects a PR state changed to "merged" or "closed"
    2. Find associated task_id
    3. Get worktree record: `db.get_worktree_for_task(task_id)`
    4. If worktree exists and PR is merged:
       a. Stop the OpenCode server for this task (emit event for ServerManager to handle, or call cleanup directly)
       b. Remove worktree via `git_worktree::remove_worktree()`
       c. Delete worktree record from DB
       d. Emit `worktree-cleaned` event
  - Update `PollerConfig` to include `project_id` and read from project_config

  **Must NOT do**:
  - Don't change GitHub API calls or comment parsing
  - Don't auto-delete tasks when PR merges (just clean up worktree)
  - Don't block the poll loop on worktree cleanup (spawn as async task)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Moderate changes — project iteration + worktree cleanup trigger
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 9, 11-14)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_poller.rs:41-112` — Current `start_github_poller()`: Wrap in project loop
  - `src-tauri/src/github_poller.rs:154-231` — `sync_open_prs()`: Add merge detection and cleanup trigger
  - `src-tauri/src/git_worktree.rs` — New `remove_worktree()` (from T3)
  - `src-tauri/src/db.rs` — New `get_worktree_for_task()`, `delete_worktree_record()` (from T1)

  **Acceptance Criteria**:
  - [ ] Poller iterates all projects with GitHub config
  - [ ] PR merge triggers worktree cleanup
  - [ ] Worktree cleanup: removes worktree, deletes DB record, emits event
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Per-project polling + cleanup logic
    Tool: Bash (grep)
    Steps:
      1. grep -n "get_all_projects\|remove_worktree\|worktree-cleaned\|delete_worktree_record" src-tauri/src/github_poller.rs
    Expected Result: Project iteration and worktree cleanup logic present
    Evidence: .sisyphus/evidence/task-10-github-per-project.txt
  ```

  **Commit**: YES
  - Message: `refactor(github): scope polling to per-project config with worktree cleanup on merge`
  - Files: `src-tauri/src/github_poller.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 11. ProjectSwitcher + ProjectSetupDialog Components

  **What to do**:
  - Create `src/components/ProjectSwitcher.svelte`:
    - Dropdown in header area showing all projects
    - Currently active project highlighted with checkmark or bold
    - Click to switch → updates `$activeProjectId` store
    - "New Project" button at bottom opens ProjectSetupDialog
    - Shows project name and a colored dot (based on project hash for variety)
    - If no projects exist, shows "Create your first project" prompt
  - Create `src/components/ProjectSetupDialog.svelte`:
    - Modal dialog for creating a new project
    - Step 1: Project name (required) + Repos root path (required, text input)
    - Step 2 (inline, optional): JIRA config (base URL, username, token, board ID)
    - Step 3 (inline, optional): GitHub config (token, repo)
    - On submit: calls `createProject()` IPC, then `setProjectConfig()` for each non-empty config field
    - Dispatches `project-created` event
    - Close on overlay click, Escape, Cancel
  - Style: Match existing Tokyo Night theme. Dropdown should feel like Slack/Linear workspace switcher.

  **Must NOT do**:
  - Don't add file picker for repos root (just text input — file pickers need Tauri dialog plugin)
  - Don't validate repos root path exists (backend will handle that)
  - Don't add project deletion in this component (that's in settings)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Two new UI components with interaction states, modal pattern, form steps, theme consistency
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Dropdown design, modal form UX, workspace switcher pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10, 12-14)
  - **Blocks**: Tasks 16, 18
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/components/AddTaskDialog.svelte` — Modal pattern: overlay, form, close handlers. Follow for ProjectSetupDialog.
  - `src/components/SettingsPanel.svelte:72-138` — Form sections with labels and inputs. Follow for setup steps.
  - `src/App.svelte:122-141` — Header area: ProjectSwitcher will be placed here.

  **Acceptance Criteria**:
  - [ ] ProjectSwitcher renders dropdown with projects from `$projects` store
  - [ ] Clicking a project sets `$activeProjectId`
  - [ ] "New Project" button opens ProjectSetupDialog
  - [ ] ProjectSetupDialog creates project via IPC and saves config
  - [ ] Both components styled with Tokyo Night theme
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Components compile
    Tool: Bash
    Steps:
      1. Run: npm run build 2>&1 | tail -20
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-11-project-ui.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): add ProjectSwitcher dropdown and ProjectSetupDialog`
  - Files: `src/components/ProjectSwitcher.svelte`, `src/components/ProjectSetupDialog.svelte`

---

- [ ] 12. RepoPickerDialog Component

  **What to do**:
  - Create `src/components/RepoPickerDialog.svelte`:
    - Modal dialog triggered when "Start Implementation" is clicked
    - Props: `taskId: string`, `reposRootPath: string`
    - On mount: calls `scanRepos(reposRootPath)` IPC → shows list of discovered repos
    - Each repo shown with name and path
    - User clicks a repo → dispatches `repo-selected` event with `{ taskId, repoPath }`
    - Loading state while scanning
    - Empty state: "No git repositories found in {path}"
    - Close on overlay click, Escape, Cancel

  **Must NOT do**:
  - Don't add repo cloning
  - Don't add branch selection (branches are auto-created)
  - Don't cache repo scan results (always fresh scan)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: New dialog component with async data loading, list rendering, selection
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: List selection pattern, loading states, empty states

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13, 14)
  - **Blocks**: Task 16
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/components/AddTaskDialog.svelte` — Modal pattern to follow
  - `src/components/KanbanBoard.svelte:101-103` — Empty state pattern

  **Acceptance Criteria**:
  - [ ] Dialog calls `scanRepos` on mount
  - [ ] Shows list of discovered repos
  - [ ] Clicking repo dispatches `repo-selected` event
  - [ ] Loading and empty states handled
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Component compiles
    Tool: Bash
    Steps:
      1. Run: npm run build 2>&1
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-12-repo-picker.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): add RepoPickerDialog for implementation target selection`
  - Files: `src/components/RepoPickerDialog.svelte`

---

- [ ] 13. AgentPanel Component

  **What to do**:
  - Create `src/components/AgentPanel.svelte`:
    - This REPLACES CheckpointPanel as the primary agent interaction UI
    - Props: `taskId: string`
    - Listens for `agent-event` Tauri events, filters by `taskId`
    - Displays live stream of agent events:
      - `message.part.delta`: Append text delta to output area (streaming text)
      - `message.updated`: Full message update
      - `session.idle`: Show "Implementation complete" status
      - `session.error`: Show error message in red
      - `permission.asked` / `question.asked`: Show info banner (auto-approved in V1)
    - Output area: monospace font, auto-scroll to bottom, scrollable
    - Status indicator at top: "Running" (green pulse), "Complete" (green static), "Error" (red), "Idle" (gray)
    - Abort button (red): calls `abortImplementation(taskId)` IPC
    - If no active implementation for this task, show "No active implementation" empty state

  **Must NOT do**:
  - Don't add approve/reject buttons (no checkpoints)
  - Don't add manual prompt input (fire-and-forget model)
  - Don't persist events to DB (in-memory only via store)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: New component with real-time event streaming, status indicators, auto-scroll, and theming
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Real-time output display, status indicators, streaming text UX

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12, 14)
  - **Blocks**: Task 17
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/components/LogViewer.svelte` — Agent log display pattern: monospace, auto-scroll, session-scoped. AgentPanel is similar but real-time (events push in) instead of polling.
  - `src/components/CheckpointPanel.svelte` — What we're REPLACING. Understand its structure to know what NOT to include (no approve/reject).
  - `src/App.svelte:72-114` — Event listener pattern: `listen('event-name', handler)`. AgentPanel uses same pattern for `agent-event`.

  **Acceptance Criteria**:
  - [ ] Listens for `agent-event` Tauri events filtered by taskId
  - [ ] Displays streaming text from `message.part.delta` events
  - [ ] Shows status indicator (running/complete/error/idle)
  - [ ] Abort button calls `abortImplementation`
  - [ ] Auto-scroll to bottom on new events
  - [ ] Monospace output area with Tokyo Night theme
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Component compiles
    Tool: Bash
    Steps:
      1. Run: npm run build 2>&1
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-13-agent-panel.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): add AgentPanel for live SSE event streaming`
  - Files: `src/components/AgentPanel.svelte`

---

- [ ] 14. SettingsPanel Per-Project Rewrite

  **What to do**:
  - Rewrite `src/components/SettingsPanel.svelte` to use per-project config:
    - Requires `$activeProjectId` to be set (show message if no project selected)
    - Replace all `getConfig(key)` calls with `getProjectConfig(projectId, key)`
    - Replace all `setConfig(key, value)` calls with `setProjectConfig(projectId, key, value)`
    - Add header showing "Settings for: {project name}"
    - Add "Project" section at top:
      - Project name (editable)
      - Repos root path (editable)
      - "Delete Project" button (red, with confirmation)
    - Keep JIRA section (now per-project)
    - Keep GitHub section (now per-project)
    - REMOVE OpenCode port section (no longer relevant — dynamic ports)
    - Remove filter_assigned_to_me and exclude_done_tickets checkboxes (not relevant after decouple)
    - Remove custom_jql field (not relevant after decouple)

  **Must NOT do**:
  - Don't add global settings section
  - Don't add project creation here (that's in ProjectSetupDialog)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Significant rewrite of existing component — new data source, new sections, removed sections
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Form layout, per-context settings pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-13)
  - **Blocks**: Task 18
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/components/SettingsPanel.svelte:1-146` — ENTIRE FILE: rewrite onMount, save, and template to use per-project config
  - `src/lib/ipc.ts` — New `getProjectConfig`, `setProjectConfig` functions (from T2)

  **Acceptance Criteria**:
  - [ ] All config reads use `getProjectConfig(projectId, key)`
  - [ ] All config writes use `setProjectConfig(projectId, key, value)`
  - [ ] Shows active project name in header
  - [ ] OpenCode port section removed
  - [ ] Filter/JQL sections removed
  - [ ] Project settings section (name, repos root, delete) present
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Per-project settings
    Tool: Bash (grep)
    Steps:
      1. grep -n "getProjectConfig\|setProjectConfig" src/components/SettingsPanel.svelte
      2. grep -c "getConfig\b" src/components/SettingsPanel.svelte (should be 0)
    Expected Result: Only project-scoped config calls, no global config calls
    Evidence: .sisyphus/evidence/task-14-settings.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): rewrite SettingsPanel for per-project configuration`
  - Files: `src/components/SettingsPanel.svelte`

---

- [ ] 15. Main.rs Full Rewrite

  **What to do**:
  - This is the central integration task. All new modules converge here.
  - **Module declarations**: Add `mod git_worktree; mod server_manager; mod sse_bridge; mod agent_coordinator;`. Keep existing: `mod db; mod opencode_client; mod jira_client; mod jira_sync; mod github_client; mod github_poller;`. Do NOT remove `mod opencode_manager;` yet (T19 handles that) or `mod orchestrator;` — just stop using them.
  - **New state types** (managed in setup):
    - `server_manager::ServerManager` — per-worktree server lifecycle
    - `sse_bridge::SseBridgeManager` — multiplexed SSE streams
  - **New Tauri commands** (add to invoke_handler):
    - `create_project(db, name, repos_root_path) -> ProjectRow`
    - `get_projects(db) -> Vec<ProjectRow>`
    - `update_project(db, id, name, repos_root_path) -> ()`
    - `delete_project(db, id) -> ()`
    - `get_project_config(db, project_id, key) -> Option<String>`
    - `set_project_config(db, project_id, key, value) -> ()`
    - `scan_repos(repos_root_path) -> Vec<RepoInfo>`: Calls `git_worktree::scan_repos()`
    - `get_tasks_for_project(db, project_id) -> Vec<TaskRow>`: Calls `db.get_tasks_for_project()`
    - `start_implementation(db, server_mgr, sse_mgr, app, task_id, repo_path) -> ImplementationResult`:
      1. Get task from DB
      2. Create worktree: `git_worktree::create_worktree(repo_path, worktree_path, branch_name, "HEAD")`
      3. Record worktree in DB
      4. Spawn server: `server_mgr.spawn_server(task_id, worktree_path)`
      5. Update worktree record with port/pid
      6. Start SSE bridge: `sse_mgr.start_bridge(app, task_id, port)`
      7. Start implementation: `agent_coordinator::start_implementation(db, app, task_id, port)`
      8. Return `{ task_id, worktree_path, port, session_id }`
    - `abort_implementation(db, server_mgr, sse_mgr, app, task_id) -> ()`:
      1. Abort agent
      2. Stop SSE bridge
      3. Stop server
      4. Update worktree status to "stopped"
    - `get_worktree_for_task(db, task_id) -> Option<WorktreeRow>`
  - **Updated commands**:
    - `create_task`: Accept optional `project_id` parameter
    - `get_tasks`: Keep as-is (returns all tasks; frontend filters by project)
  - **Commands to deprecate** (stop registering in invoke_handler but don't delete functions yet):
    - `approve_checkpoint`, `reject_checkpoint` (checkpoints gone)
    - `start_ticket_implementation` (replaced by `start_implementation`)
    - `address_selected_pr_comments` (old orchestrator flow)
  - **Setup function changes**:
    - Remove: `OpenCodeManager::start()` block (no global server at startup)
    - Remove: Orchestrator creation
    - Add: `ServerManager::new()` + manage
    - Add: `SseBridgeManager::new()` + manage
    - Add: `server_mgr.cleanup_stale_pids()` call on startup
    - Keep: Database, JiraClient, GitHubClient, OpenCodeClient (for health checks)
    - Keep: jira_sync and github_poller background tasks
    - Remove: old inline `start_sse_bridge` call (replaced by per-task bridges)
    - Add: event listeners for `implementation-complete` and `implementation-failed` to trigger DB updates via agent_coordinator
  - **Remove inline code**:
    - Delete `start_sse_bridge()` function and `SseEventPayload` struct (moved to sse_bridge module)

  **Must NOT do**:
  - Don't delete orchestrator.rs or opencode_manager.rs files (T19 handles that)
  - Don't restructure the file beyond what's needed for new commands
  - Don't change PR/comment commands

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Major integration task — new commands, state management, setup rewrite, command registration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16, 17)
  - **Blocks**: Tasks 18, 19
  - **Blocked By**: Tasks 1, 3-6, 8-10

  **References**:

  **Pattern References**:
  - `src-tauri/src/main.rs:631-733` — setup() + invoke_handler: The section to rewrite
  - `src-tauri/src/main.rs:25-43` — `get_opencode_status` command: Pattern for new commands (State, Result<T, String>)
  - `src-tauri/src/main.rs:563-625` — `start_sse_bridge`: DELETE this (moved to sse_bridge module)
  - `src-tauri/src/main.rs:703-730` — invoke_handler macro: UPDATE with new commands, remove deprecated

  **Acceptance Criteria**:
  - [ ] All new commands registered in invoke_handler
  - [ ] `start_implementation` orchestrates: worktree → server → SSE → agent
  - [ ] `abort_implementation` cleanly stops everything
  - [ ] No global OpenCode server at startup (servers spawn on demand)
  - [ ] ServerManager and SseBridgeManager in managed state
  - [ ] Old SSE bridge code removed from main.rs
  - [ ] `cargo build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Backend compiles with new architecture
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-15-main-rewrite.txt

  Scenario: New commands registered
    Tool: Bash (grep)
    Steps:
      1. grep -c "create_project\|get_projects\|scan_repos\|start_implementation\|abort_implementation" src-tauri/src/main.rs
    Expected Result: At least 5 matches (command definitions + handler registration)
    Evidence: .sisyphus/evidence/task-15-commands.txt

  Scenario: Old orchestrator commands removed from handler
    Tool: Bash (grep)
    Steps:
      1. grep "approve_checkpoint\|reject_checkpoint\|start_ticket_implementation\|address_selected_pr_comments" src-tauri/src/main.rs | grep -v "//"
    Expected Result: Not in invoke_handler (may still exist as dead functions until T19)
    Evidence: .sisyphus/evidence/task-15-old-commands.txt
  ```

  **Commit**: YES
  - Message: `feat(app): rewrite main.rs with multi-project, worktree, and agent integration`
  - Files: `src-tauri/src/main.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml`

---

- [ ] 16. KanbanBoard Update

  **What to do**:
  - Update `src/components/KanbanBoard.svelte`:
    - "Start Implementation" context menu item: Instead of calling `startTicketImplementation`, dispatch a `start-implementation` event with `{ taskId }`. Parent (App.svelte) handles showing RepoPickerDialog → calling `startImplementation` IPC.
    - Remove: `import { startTicketImplementation }` (replaced by event dispatch)
    - Add: Show worktree status on cards if implementation is active (small indicator on TaskCard or via session status)
    - Keep: All other context menu items (Move to, Delete)
    - Keep: AddTaskInline integration
    - Note: Task filtering by project is handled in App.svelte (passes filtered `$tasks` or board reads from store which App.svelte keeps updated)

  **Must NOT do**:
  - Don't add drag-and-drop
  - Don't add project filtering logic here (that's App.svelte's responsibility)
  - Don't call `startImplementation` directly (delegate to parent via event)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI changes to context menu behavior and implementation status display
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15, 17)
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 2, 11, 12

  **References**:

  **Pattern References**:
  - `src/components/KanbanBoard.svelte:44-52` — `handleStartImplementation()`: Replace direct IPC call with event dispatch
  - `src/components/KanbanBoard.svelte:109-127` — Context menu: "Start Implementation" button stays but behavior changes

  **Acceptance Criteria**:
  - [ ] "Start Implementation" dispatches event instead of calling IPC directly
  - [ ] `startTicketImplementation` import removed
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: No direct startTicketImplementation call
    Tool: Bash (grep)
    Steps:
      1. grep -n "startTicketImplementation" src/components/KanbanBoard.svelte
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-16-kanban.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): update KanbanBoard to delegate implementation start to parent`
  - Files: `src/components/KanbanBoard.svelte`

---

- [ ] 17. DetailPanel Update

  **What to do**:
  - Update `src/components/DetailPanel.svelte`:
    - Replace "Checkpoints" tab with "Agent" tab:
      - Remove `CheckpointPanel` import
      - Add `AgentPanel` import
      - Tab label: "Agent" (instead of "Checkpoints")
      - Content: `<AgentPanel taskId={task.id} />` (always shown, AgentPanel handles empty state internally)
    - Keep: Overview tab, Agent Logs tab, PR Comments tab
    - Add worktree info to overview tab (if worktree exists):
      - Show: branch name, worktree path, server status
      - This requires calling `getWorktreeForTask(task.id)` — add reactive fetch
    - Remove: Approve/Reject checkpoint buttons (if any remain)
    - Keep: Abort button (now calls `abortImplementation` instead of `abortSession`)

  **Must NOT do**:
  - Don't remove the Logs tab (LogViewer still useful for historical logs)
  - Don't add file diff viewer

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Tab replacement, new data source integration, layout updates
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 15, 16)
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 2, 13

  **References**:

  **Pattern References**:
  - `src/components/DetailPanel.svelte:68-78` — Tab definitions: Replace "Checkpoints" with "Agent"
  - `src/components/DetailPanel.svelte:25-32` — Abort handler: Update to call `abortImplementation`
  - `src/components/AgentPanel.svelte` — New component (from T13): Import and use

  **Acceptance Criteria**:
  - [ ] "Checkpoints" tab replaced with "Agent" tab showing AgentPanel
  - [ ] CheckpointPanel import removed
  - [ ] Abort calls `abortImplementation` (not `abortSession`)
  - [ ] Worktree info shown in overview if worktree exists
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: No checkpoint references
    Tool: Bash (grep)
    Steps:
      1. grep -in "checkpoint\|CheckpointPanel\|approveCheckpoint\|rejectCheckpoint" src/components/DetailPanel.svelte
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-17-detail.txt
  ```

  **Commit**: YES
  - Message: `refactor(ui): replace checkpoint tab with AgentPanel in DetailPanel`
  - Files: `src/components/DetailPanel.svelte`

---

- [ ] 18. App.svelte Full Rewrite

  **What to do**:
  - Major rewrite of `src/App.svelte` to add project context:
  - **Imports**: Add `projects`, `activeProjectId`, `agentEvents` stores. Add `getProjects`, `getTasksForProject`, `startImplementation`, `abortImplementation`, `getWorktreeForTask` IPC. Add `ProjectSwitcher`, `ProjectSetupDialog`, `RepoPickerDialog` components. Remove `checkOpenCodeInstalled`.
  - **State**: Add `showProjectSetup`, `showRepoPicker`, `repoPickerTaskId`. Remove `openCodeInstalled`.
  - **Project loading**:
    - `loadProjects()`: Fetch all projects, set `$projects`. If projects exist and no active project, set first as active.
    - First-run detection: If no projects, show ProjectSetupDialog automatically.
  - **Task loading**: Change `loadTasks()` to load project-scoped tasks: `getTasksForProject($activeProjectId)`. Re-trigger on `$activeProjectId` change.
  - **Active project reactive**: `$: if ($activeProjectId) { loadTasks(); loadPullRequests(); }`
  - **"Start Implementation" flow**:
    1. KanbanBoard dispatches `start-implementation` event with `{ taskId }`
    2. App shows RepoPickerDialog for that task
    3. User picks repo → RepoPickerDialog dispatches `repo-selected` with `{ taskId, repoPath }`
    4. App calls `startImplementation(taskId, repoPath)` IPC
    5. On success: reload tasks, show toast
  - **Event listeners**: Replace old checkpoint events with new ones:
    - Remove: `checkpoint-reached`, `stage-completed` listeners
    - Add: `implementation-complete` → reload tasks, update session
    - Add: `implementation-failed` → show error toast, reload tasks
    - Add: `worktree-cleaned` → reload tasks
    - Keep: `jira-sync-complete`, `new-pr-comment`, `session-aborted`
  - **Header**: Add ProjectSwitcher in top-bar between title and status bar
  - **Remove**: OpenCode installed check / setup banner (servers spawn on demand, no global server)
  - **Layout**: Keep board-area + detail-area split. Add project setup as full-screen overlay when no projects.

  **Must NOT do**:
  - Don't add project management (CRUD) beyond switching — that's in SettingsPanel
  - Don't add multiple boards side-by-side
  - Don't change the CSS variable definitions

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Major rewrite touching imports, state, functions, event listeners, template, and component integration
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: App shell design, project context flow, first-run experience

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 19)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 11-17

  **References**:

  **Pattern References**:
  - `src/App.svelte:1-119` — ENTIRE script section: rewrite with project context
  - `src/App.svelte:60-115` — Event listeners: Replace checkpoint events with implementation events
  - `src/App.svelte:122-177` — Template: Add ProjectSwitcher, RepoPickerDialog, ProjectSetupDialog
  - `src/components/ProjectSwitcher.svelte` — From T11
  - `src/components/RepoPickerDialog.svelte` — From T12

  **Acceptance Criteria**:
  - [ ] Projects loaded on mount, first project auto-selected
  - [ ] Tasks loaded per active project
  - [ ] ProjectSwitcher in header
  - [ ] "Start Implementation" → RepoPickerDialog → IPC flow works
  - [ ] `implementation-complete` and `implementation-failed` event listeners present
  - [ ] No `checkpoint-reached` or `stage-completed` listeners
  - [ ] First-run shows ProjectSetupDialog
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Full frontend build succeeds
    Tool: Bash
    Steps:
      1. Run: npm run build 2>&1
    Expected Result: Build completes with 0 errors
    Evidence: .sisyphus/evidence/task-18-app-build.txt

  Scenario: No old checkpoint references
    Tool: Bash (grep)
    Steps:
      1. grep -in "checkpoint-reached\|stage-completed\|checkOpenCodeInstalled\|openCodeInstalled" src/App.svelte
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-18-no-checkpoints.txt
  ```

  **Commit**: YES
  - Message: `feat(app): rewrite App.svelte with multi-project context and agent integration`
  - Files: `src/App.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 19. Cleanup — Remove Dead Code and Old Modules

  **What to do**:
  - Delete `src-tauri/src/orchestrator.rs`: Entirely replaced by agent_coordinator.rs
  - Delete `src-tauri/src/opencode_manager.rs`: Entirely replaced by server_manager.rs
  - Delete `src/components/CheckpointPanel.svelte`: Replaced by AgentPanel.svelte
  - Remove from main.rs: `mod orchestrator;` and `mod opencode_manager;` declarations
  - Remove from main.rs: Any dead command functions that were deprecated in T15 (approve_checkpoint, reject_checkpoint, start_ticket_implementation, address_selected_pr_comments)
  - Remove from main.rs: Orchestrator state management (`app.manage(orchestrator)`)
  - Remove from main.rs: OpenCodeManager state management (`app.manage(opencode_manager)`)
  - Remove old SSE bridge: `SseEventPayload` struct and `start_sse_bridge` function (if not already removed in T15)
  - Run both builds to verify nothing broke

  **Must NOT do**:
  - Don't delete opencode_client.rs (still in use, expanded)
  - Don't delete any test files that other tasks reference

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File deletions and removing dead code — straightforward cleanup
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 18)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 15

  **References**:

  **Pattern References**:
  - `src-tauri/src/main.rs:4-11` — Module declarations to update
  - `src-tauri/src/orchestrator.rs` — DELETE this file
  - `src-tauri/src/opencode_manager.rs` — DELETE this file
  - `src/components/CheckpointPanel.svelte` — DELETE this file

  **Acceptance Criteria**:
  - [ ] orchestrator.rs deleted
  - [ ] opencode_manager.rs deleted
  - [ ] CheckpointPanel.svelte deleted
  - [ ] No `mod orchestrator` or `mod opencode_manager` in main.rs
  - [ ] No dead command functions in main.rs
  - [ ] `cargo build` succeeds
  - [ ] `npm run build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Dead files removed
    Tool: Bash
    Steps:
      1. ls src-tauri/src/orchestrator.rs 2>&1
      2. ls src-tauri/src/opencode_manager.rs 2>&1
      3. ls src/components/CheckpointPanel.svelte 2>&1
    Expected Result: All 3 return "No such file or directory"
    Evidence: .sisyphus/evidence/task-19-cleanup.txt

  Scenario: Both builds succeed after cleanup
    Tool: Bash
    Steps:
      1. Run: cargo build --manifest-path src-tauri/Cargo.toml 2>&1 && npm run build 2>&1
    Expected Result: Both builds clean
    Evidence: .sisyphus/evidence/task-19-builds.txt
  ```

  **Commit**: YES
  - Message: `chore: remove orchestrator, opencode_manager, and CheckpointPanel (replaced)`
  - Files: deleted: `src-tauri/src/orchestrator.rs`, `src-tauri/src/opencode_manager.rs`, `src/components/CheckpointPanel.svelte`; modified: `src-tauri/src/main.rs`
  - Pre-commit: `cargo build --manifest-path src-tauri/Cargo.toml && npm run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, grep for functions). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `cargo build --manifest-path src-tauri/Cargo.toml` + `npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real QA — Full Flow Verification** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Verify full flow: create project → settings → scan repos → create task → start implementation → repo picker → worktree created → server spawns → SSE events appear → abort. Test edge cases: no projects, no repos, empty repos root. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes. Verify dead code is removed.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(db): add projects, project_config, and worktrees tables` | db.rs | cargo build |
| 2 | `feat(frontend): add project, worktree, and agent event types` | types.ts, stores.ts, ipc.ts | — |
| 3 | `feat(git): add git worktree management module` | git_worktree.rs | cargo build |
| 4 | `feat(server): add per-worktree OpenCode server manager` | server_manager.rs | cargo build |
| 5 | `feat(sse): add multiplexed SSE bridge for per-task event streaming` | sse_bridge.rs | cargo build |
| 6 | `feat(opencode): add prompt_async, abort, agents, and session info` | opencode_client.rs | cargo build |
| 7 | `build(deps): add git2, eventsource-client, dashmap, and utilities` | Cargo.toml | cargo build |
| 8 | `feat(agent): add thin agent coordinator replacing checkpoint orchestrator` | agent_coordinator.rs | cargo build |
| 9 | `refactor(jira-sync): scope JIRA sync to per-project config` | jira_sync.rs | cargo build |
| 10 | `refactor(github): scope polling to per-project with worktree cleanup` | github_poller.rs | cargo build |
| 11 | `feat(ui): add ProjectSwitcher and ProjectSetupDialog` | ProjectSwitcher.svelte, ProjectSetupDialog.svelte | — |
| 12 | `feat(ui): add RepoPickerDialog` | RepoPickerDialog.svelte | — |
| 13 | `feat(ui): add AgentPanel for live SSE event streaming` | AgentPanel.svelte | — |
| 14 | `refactor(ui): rewrite SettingsPanel for per-project config` | SettingsPanel.svelte | — |
| 15 | `feat(app): rewrite main.rs with multi-project and agent integration` | main.rs | cargo build |
| 16 | `refactor(ui): update KanbanBoard for new implementation flow` | KanbanBoard.svelte | — |
| 17 | `refactor(ui): replace checkpoint tab with AgentPanel in DetailPanel` | DetailPanel.svelte | — |
| 18 | `feat(app): rewrite App.svelte with multi-project context` | App.svelte | npm run build |
| 19 | `chore: remove orchestrator, opencode_manager, CheckpointPanel` | deleted files + main.rs | cargo build + npm run build |

---

## Success Criteria

### Verification Commands
```bash
cargo build --manifest-path src-tauri/Cargo.toml  # Expected: compiles with 0 errors
npm run build                                       # Expected: Vite build succeeds
```

### Final Checklist
- [ ] Projects can be created with name and repos root path
- [ ] Project switcher switches active project and reloads tasks
- [ ] Per-project settings (JIRA, GitHub) saved and loaded correctly
- [ ] Repos discovered by scanning repos root path
- [ ] "Start Implementation" opens repo picker, creates worktree, spawns server
- [ ] OpenCode server uses dynamic port (--port 0)
- [ ] SSE events stream into AgentPanel in real-time with task_id routing
- [ ] Agent can be aborted via abort button
- [ ] Worktree cleaned up on PR merge
- [ ] No checkpoint/approve/reject flow remains
- [ ] orchestrator.rs, opencode_manager.rs, CheckpointPanel.svelte deleted
- [ ] Both builds succeed (cargo + vite)

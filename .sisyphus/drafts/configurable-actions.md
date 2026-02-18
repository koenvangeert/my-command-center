# Draft: Configurable Actions with Custom Prompts

## Requirements (confirmed)
- "Start work" action should be configurable per project with a custom prompt
- Ability to add additional "Actions" beyond start work
- Provide some OOTB (out-of-the-box) actions with default prompts

## Research Findings

### Current "Start Implementation" Flow
1. **UI**: KanbanBoard.svelte context menu → "Start Implementation" button (line 110)
2. **Event**: Dispatches `start-implementation` event → handled in App.svelte (line 120)
3. **IPC**: `startImplementation(taskId, repoPath)` → Rust `start_implementation` command
4. **Rust (main.rs:283-422)**: Creates git worktree → spawns OpenCode server → starts SSE bridge → creates session → builds prompt → sends to OpenCode
5. **Prompt Construction (main.rs:358-383)**: Assembles task context (title, description, acceptance criteria, plan text) + HARDCODED instruction: "Implement this task. Create a branch, make the changes, and create a pull request when done."

### Per-Project Config Already Exists
- `project_config` table: `(project_id, key, value)` with UNIQUE constraint
- Rust methods: `get_project_config()`, `set_project_config()`, `get_all_project_config()`
- IPC: `getProjectConfig()`, `setProjectConfig()` already in ipc.ts
- Settings UI: SettingsPanel.svelte loads/saves per-project config

### Context Menu (KanbanBoard.svelte:108-126)
Currently shows: "Start Implementation" | "Move to..." | divider | "Delete"

### Prompt is passed to OpenCode via `prompt_async(session_id, prompt, None)` 
- The `None` is for an optional `agent` parameter (not currently used)

## Technical Decisions
- **Prompt scope**: Only the instruction part is configurable. Task context (title, description, AC, plan) is always auto-assembled and prepended.
- **Execution model**: Two modes — "full" (new worktree + OpenCode session, like today) and "lightweight" (send prompt to an existing running session for the task)
- **Config UI**: New "Actions" section added to existing SettingsPanel.svelte
- **OOTB defaults**: Start Implementation, Plan/Design, Manual Testing

## Open Questions
- How should lightweight actions appear in the context menu? (only when a session is already running for the task?)
- Should the user be able to delete/disable OOTB actions, or only edit their prompts?
- What does "Manual Testing" action do? (generate test plan? instruct agent to run tests? describe manual steps?)
- Should actions have an ordering for the context menu?

## Scope Boundaries
- INCLUDE: (to be defined)
- EXCLUDE: (to be defined)

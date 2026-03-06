# Learnings: MCP Dynamic Titles

## T-512: TLDR Summary Subtitle on Kanban Cards

### What was done
- Added title fallback chain in `TaskCard.svelte`: `task.title || (task.prompt?.split('\n')[0]) || task.id`
- Added summary subtitle below title using `{#if task.summary}` block
- Summary uses daisyUI classes: `text-xs text-base-content/50 truncate`
- Updated test `baseTask` to include `prompt: null` and `summary: null` fields (required by Task interface)

### Key patterns
- Title fallback: use `task.title || (task.prompt?.split('\n')[0]) || task.id` — the optional chaining `?.` handles `prompt: null` safely
- Conditional subtitle: `{#if task.summary}` renders nothing when null — no empty space
- The `firstLine()` helper already existed in the component; the fallback can reuse it inline
- When `task.title` is an empty string `''`, it is falsy in JS, so the fallback chain works correctly

### Test patterns
- Mock tasks must include all fields from the `Task` interface — when types.ts is updated, test fixtures need updating too
- TDD order: update `baseTask` + add new tests → confirm failures → implement → confirm green

## T-512: update_task and get_task_info MCP tools + GET /task/:id endpoint

### What was done
- Added `update_task` and `get_task_info` tools to `src-tauri/src/mcp-server/index.js`
- Added `GetTaskInfoResponse` struct, `get_task_info_handler`, and `/task/:id` GET route to `http_server.rs`

### Key patterns
- `db.get_task()` is the existing function (not `get_task_by_id`) — use it directly in `get_task_info_handler`
- axum path param extraction: `Path(id): Path<String>` as first extractor, `use axum::extract::Path;`
- Add `get` to routing import: `use axum::routing::{post, get};`
- `GetTaskInfoResponse` serializes `Option<String>` fields as JSON `null` when `None`
- Route chained as `.route("/task/:id", get(get_task_info_handler))`
- MCP tool graceful error: `catch (e) { return { content: [{ type: 'text', text: \`Error: ${message}. Is Open Forge running?\` }] }; }`
- `tools/list` JSON-RPC confirms 3 tools with correct inputSchema (zod → JSON Schema auto-conversion)
- 56 http_server tests pass; 5 new `GetTaskInfoResponse` serialization tests added

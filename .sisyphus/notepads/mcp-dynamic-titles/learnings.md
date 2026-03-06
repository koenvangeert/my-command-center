# Learnings — mcp-dynamic-titles

## 2026-03-06 Plan Start
- V5 migration uses `M::up_with_hook` pattern (not plain SQL). Follow the same for V6.
- `title TEXT NOT NULL` — keep constraint, use empty string `""` default
- `build_task_prompt()` is at orchestration.rs:5-28, uses `task.title` on line 15
- Existing `create_task.ts` plugin has auth bug (no bearer token) — moot since replacing with MCP
- Both providers (OpenCode + Claude Code) support MCP servers
- Token regenerates each app start — MCP server must read from env at invocation, not config parse time
- AGENTS.md mandates TDD: RED → GREEN → REFACTOR

## 2026-03-06 Task 3 — MCP server scaffold
- `@modelcontextprotocol/sdk` v1.12.0 installed; imports via `@modelcontextprotocol/sdk/server/mcp.js` and `/server/stdio.js`
- `McpServer` (high-level API) preferred over low-level `Server` class — simpler tool registration later
- Entry point is plain `.js` with `"type":"module"` in package.json — no TS build step needed
- `OPENFORGE_HTTP_PORT` (default `17422`) + `OPENFORGE_HTTP_TOKEN` read at top of module (invocation time)
- `console.error()` for server logs — stdout is reserved exclusively for JSON-RPC wire protocol
- `server.connect(transport)` must be awaited before the server handles messages
- Initialize response includes `serverInfo.name` + `serverInfo.version` from `new McpServer({name, version})`
- Tool-less server responds to `initialize` with `capabilities: {}` — no negotiation errors

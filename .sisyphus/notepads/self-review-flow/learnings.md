# Learnings — self-review-flow

## Conventions Discovered
<!-- Append here, never overwrite -->

## Diff Parser Implementation (Wave 1)

### Unified Diff Parsing Pattern
- Split on `diff --git a/... b/...` headers to identify file boundaries
- Extract filename from `b/` path in header (rightmost occurrence)
- Use state machine: track `in_patch` flag to distinguish metadata from hunk content
- Hunk lines start with `@@` markers; collect all subsequent `+`, `-`, and context lines

### File Status Detection
- `new file mode` → "added"
- `deleted file mode` → "removed"
- `rename from/to` → "renamed" (set `previous_filename` from "rename from" line)
- `Binary files ... differ` → "binary" (set `patch = None`)
- Default → "modified"

### Line Counting
- Count `+` lines (excluding `+++` header) as additions
- Count `-` lines (excluding `---` header) as deletions
- Include context lines (` ` prefix) and `\ No newline` in patch output
- `changes = additions + deletions`

### Struct Serialization
- `TaskFileDiff` must match `PrFileDiff` interface exactly (field names, types)
- Use `#[derive(Debug, Clone, Serialize)]` for serde compatibility
- All fields are public (`pub`)
- `sha` field set to empty string (git diff doesn't provide commit SHAs)
- `patch` is `Option<String>` — `None` for binary files, `Some(...)` for text diffs

### Testing Strategy
- Test empty input (no panic, return empty vec)
- Test single file with additions/deletions
- Test file added (new file mode)
- Test file deleted (deleted file mode)
- Test file renamed (rename from/to)
- Test binary files (Binary files differ)
- Test multi-file diffs (verify file boundaries)
- Test patch content preservation (verify hunk lines included)

### Module Integration
- Declare in `main.rs` with `mod diff_parser;`
- No Tauri commands needed — pure parsing function
- No external dependencies beyond serde (already in Cargo.toml)
- Tests compile and run with `cargo test diff_parser`

## Self Review Comments DB Implementation (Wave 1)

### Table Schema
- `self_review_comments` table with columns: id (PK), task_id, round, comment_type, file_path (nullable), line_number (nullable), body, created_at, archived_at (nullable)
- No foreign key constraints (codebase pattern)
- `archived_at IS NULL` indicates active comments; `archived_at IS NOT NULL` indicates archived

### Round Tracking Logic
- When inserting: if active comments exist for task, use their round; otherwise use max archived round + 1
- This allows seamless progression: Round 1 (active) → archive → Round 2 (active) → archive → etc.
- `get_archived_self_review_comments` returns only the latest archived round (prevents showing old rounds)

### CRUD Method Patterns
- `insert_self_review_comment`: Returns `i64` (last_insert_rowid), auto-determines round
- `get_active_self_review_comments`: WHERE archived_at IS NULL, ORDER BY created_at ASC
- `get_archived_self_review_comments`: WHERE archived_at IS NOT NULL AND round = MAX(round), ORDER BY created_at ASC
- `delete_self_review_comment`: Simple DELETE by id
- `archive_self_review_comments`: SET archived_at = now WHERE task_id = ? AND archived_at IS NULL

### Testing Strategy
- Test insert with optional fields (file_path, line_number)
- Test round auto-increment across archive cycles
- Test archive flow: active → archived → new round
- Test latest archived round filtering (only show newest round)
- Test empty task (no comments)
- Test multi-task isolation (comments don't leak between tasks)
- All 7 tests pass; full test suite: 95 tests pass

### Integration Notes
- Struct: `SelfReviewCommentRow` with `#[derive(Debug, Clone, Serialize)]`
- All fields public for serde compatibility
- Follows existing DB patterns: lock mutex, prepare/execute, map_err
- No Tauri commands added (T6 task will add them)

## TypeScript Data Layer (Wave 1 - T5)

### SelfReviewComment Interface
- Added to `src/lib/types.ts` after `ReviewSubmission` (line 189)
- Matches DB schema exactly: id, task_id, round, comment_type, file_path, line_number, body, created_at, archived_at
- Nullable fields use `T | null` pattern (not optional `?`)
- Includes JSDoc comment following existing pattern in file

### Svelte Stores
- Added 3 new stores to `src/lib/stores.ts`:
  - `selfReviewGeneralComments`: Active comments for current task
  - `selfReviewArchivedComments`: Latest archived round for current task
  - `selfReviewDiffFiles`: Task diff files (reuses `PrFileDiff` type)
- Imported `SelfReviewComment` type in existing import statement
- `PrFileDiff` already existed (lines 148-157), no new import needed

### IPC Wrappers
- Added 6 functions to `src/lib/ipc.ts` (lines 191-213):
  1. `getTaskDiff(taskId)` → `PrFileDiff[]`
  2. `addSelfReviewComment(taskId, commentType, filePath, lineNumber, body)` → `number` (comment id)
  3. `getActiveSelfReviewComments(taskId)` → `SelfReviewComment[]`
  4. `getArchivedSelfReviewComments(taskId)` → `SelfReviewComment[]`
  5. `deleteSelfReviewComment(commentId)` → `void`
  6. `archiveSelfReviewComments(taskId)` → `void`
- All use `invoke<T>('snake_case_command', { camelCaseParams })` pattern
- Tauri auto-converts camelCase params to snake_case for backend

### Build Verification
- `pnpm install` installed 144 packages (all dependencies present)
- `pnpm build` succeeded with 0 TypeScript errors
- Build output: 196 modules transformed, 485.85 kB JS (gzip 134.22 kB)
- Warnings are pre-existing (a11y, unused CSS selectors) — not introduced by this task

### Key Patterns Followed
- `import type` for type-only imports (enforced by `verbatimModuleSyntax`)
- Stores use `writable<Type>([])` initialization
- IPC functions follow existing naming: snake_case commands, camelCase params
- No modifications to existing stores, types, or IPC functions

## Review Prompt Compilation (Wave 1 - T12)

### Function Signature & Behavior
- Export: `compileReviewPrompt(taskTitle, inlineComments, generalComments) -> string`
- Pure function: no side effects, no imports from stores/IPC
- Input types:
  - `taskTitle: string`
  - `inlineComments: { path: string; line: number; body: string }[]`
  - `generalComments: { body: string }[]`
- Output: formatted prompt string for agent

### Prompt Format Rules
- **Both types present**: Include both "## Code Comments" and "## General Feedback" sections
- **Inline-only**: Omit "## General Feedback" section entirely
- **General-only**: Omit "## Code Comments" section entirely
- **Both empty**: Return empty string `""`
- Code comment format: `` `path:line` — body ``
- Numbered lists (1-indexed) for both sections
- Closing instruction always included when at least one comment type present

### Implementation Details
- Sections array pattern for clean string building
- Conditional section inclusion based on array lengths
- Backtick formatting for file references (e.g., `` `src/components/Foo.svelte:42` ``)
- Newline joining with `sections.join("\n")`
- No markdown beyond backticks and section headers

### Build Verification
- `pnpm build` passed with 0 TypeScript errors
- File created: `src/lib/reviewPrompt.ts`
- No new dependencies required (pure TypeScript)
- Warnings are pre-existing (a11y, unused CSS) — not introduced by this task

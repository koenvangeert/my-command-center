# Learnings — review-pane-perf

## Session Start
 Plan: 7 implementation tasks + 4 final verification
 Wave 1: Tasks 1, 2, 3 (parallel)
 Wave 2: Tasks 4, 5, 6 (parallel, T4 depends on T1)
 Wave 3: Task 7 (sequential)
 Wave FINAL: F1-F4 (parallel)

## Task 3: Dedup GeneralCommentsSidebar Loading

### Implementation Pattern
- **Guard Pattern**: Added `force` parameter to `loadComments(force = false)` function
- Guard checks: `if (!force && ($selfReviewGeneralComments.length > 0 || $selfReviewArchivedComments.length > 0)) return`
- Allows explicit refresh calls (add/delete) to bypass guard by passing `force=true`

### Key Insight
- Parent (SelfReviewView) loads data into stores on mount
- Child (GeneralCommentsSidebar) was re-fetching same data via $effect
- Solution: Check store state before IPC, skip if already populated
- Refresh operations (add/delete) explicitly call `loadComments(true)` to force reload

### Testing Strategy
- Mock IPC functions at module level with `vi.fn()`
- Test 1: Verify guard prevents IPC when stores populated
- Test 2: Verify IPC called when stores empty
- Test 3: Verify forced reload works after add operation
- Test 4-5: Verify rendering behavior (empty state, with data)

### Svelte Patterns Used
- `$effect` for reactive dependencies (taskId changes)
- Store subscriptions with `$store` syntax
- Async function with error handling in try/catch/finally

### Build & Test Results
- `pnpm build` ✓ (no errors, 1.6MB JS, 142KB CSS)
- All existing tests pass (no regressions)
- New test file created with 5 test cases

## Task 2: Add Database Indexes for Self-Review and Review-PR Queries

### Migration Pattern
- **Location**: `src-tauri/src/db/mod.rs` in `run_migrations()` method
- **Pattern**: All migrations use `CREATE INDEX IF NOT EXISTS` for idempotency
- **Safety**: Indexes added as separate migration step, no table modifications
- **Backward Compatibility**: IF NOT EXISTS ensures existing databases don't error on re-run

### Index Design
Four indexes created to accelerate query patterns:

1. **idx_self_review_comments_task_archived** ON self_review_comments(task_id, archived_at)
   - Accelerates: `get_active_self_review_comments()` (WHERE task_id = ? AND archived_at IS NULL)
   - Accelerates: `get_archived_self_review_comments()` (WHERE task_id = ? AND archived_at IS NOT NULL)

2. **idx_self_review_comments_task_round** ON self_review_comments(task_id, round)
   - Accelerates: Subquery in `get_archived_self_review_comments()` (SELECT MAX(round) WHERE task_id = ? AND archived_at IS NOT NULL)

3. **idx_review_prs_updated_at** ON review_prs(updated_at DESC)
   - Accelerates: `get_review_prs()` (ORDER BY updated_at DESC)
   - DESC ordering matches query pattern for most recent PRs first

4. **idx_review_prs_repo** ON review_prs(repo_owner, repo_name)
   - Accelerates: Potential repo filtering queries
   - Composite index for multi-column WHERE clauses

### Testing Strategy
- **Test**: `test_indexes_created_on_migration()` verifies all 4 indexes exist in sqlite_master
- **Approach**: Create fresh test DB, run migrations, query sqlite_master for index names
- **Result**: All 4 indexes verified to exist after migration ✓

### Build & Test Results
- `cargo build` ✓ (dev profile, 10.39s)
- `cargo test db::tests` ✓ (4 tests passed, 0 failed)
  - test_database_initialization
  - test_indexes_created_on_migration (NEW)
  - test_migration_copies_credentials_to_global
  - test_migration_does_not_overwrite_existing_global

### Performance Impact
- **Self-review queries**: Eliminates full table scans on self_review_comments table
- **Review PR queries**: Eliminates full table scans on review_prs table
- **Review pane jank**: Reduces latency from database query execution
- **Storage overhead**: Minimal (indexes are small for these tables)

### Key Learnings
1. **Migration Safety**: Always use IF NOT EXISTS for index creation to support upgrade paths
2. **Index Naming**: Prefix with table name for clarity (idx_table_columns)
3. **Composite Indexes**: Order columns by query selectivity (most selective first)
4. **DESC Ordering**: Use DESC in index definition when queries use ORDER BY DESC
5. **Test Coverage**: Verify indexes exist in sqlite_master, not just that queries work

## Task 1: merge-base caching in get_task_file_contents (2026-02-23)

### Approach taken
- Created internal `fetch_file_contents` helper taking pre-computed `merge_base: &str` param
- Kept `get_task_file_contents` (single-file) unchanged for backward compatibility
- Added new `get_task_batch_file_contents` Tauri command accepting `Vec<FileContentRequest>`
- `FileContentRequest` struct uses `#[derive(Deserialize)]` + `serde::Deserialize`
- Registered new command in `main.rs` `generate_handler!` macro
- Added `FileContentRequest` interface and `getTaskBatchFileContents` wrapper in `ipc.ts`
- Snake-case field name mapping required: frontend `oldPath` → Rust `old_path` (done via `.map(f => ({ old_path: f.oldPath, ... }))`)

### Key patterns
- Rust Tauri commands take `State<'_, Mutex<db::Database>>` — DB lock released before async I/O
- `serde::Deserialize` required on input structs for Tauri command params
- Two pre-existing test failures in `diff_parser::tests::test_truncation_*` — NOT related to this task
- Section banner pattern `// ==...==` is the AGENTS.md convention for Rust, always use it

### For Task 4 consumers
- Call `getTaskBatchFileContents(taskId, files, includeUncommitted)` with array of `{path, oldPath, status}`
- Returns `[string, string][]` parallel to input array
- `get_task_file_contents` still works for single-file calls if needed

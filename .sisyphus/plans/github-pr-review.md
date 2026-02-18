# GitHub PR Review View

## TL;DR

> **Quick Summary**: Add a full-featured GitHub PR review view to the app — browse PRs requesting your review across all repos, trigger AI-powered code reviews via OpenCode, interact with a GitHub-like diff viewer, and submit formal reviews (approve/request changes) with batched comments.
> 
> **Deliverables**:
> - Svelte 5 upgrade (foundation for diff viewer library)
> - Top-bar view switcher (Board | PR Review | Settings)
> - PR list view showing review-requested PRs across all accessible repos
> - Full diff viewer with syntax highlighting, split/unified toggle, file tree, click-to-comment
> - AI review workflow: agent reads diff → produces summary + inline comments → user accepts/rejects/edits each → batch submit as GitHub review
> - PR notification badges when new review requests arrive
> - Rust backend: new GitHub API methods, Tauri commands, DB tables for review data
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Svelte 5 upgrade → Types/DB schema → GitHub API methods → Diff viewer + AI review → Integration + QA

---

## Context

### Original Request
User wants a complete GitHub PR review view — separate from the Kanban board — where they can see all PRs requesting their review, trigger AI agent reviews, interact with a diff viewer to add comments, and submit formal GitHub reviews.

### Interview Summary
**Key Discussions**:
- **PR Source**: All repos user has access to (team/org), not just configured default repo. Use GitHub Search API.
- **GitHub Identity**: Auto-detect username via GET /user with existing PAT.
- **Navigation**: Top bar view switcher. Extend `showSettings` to `currentView` store.
- **AI Engine**: OpenCode via existing orchestrator. Agent receives diff, produces summary + inline comments.
- **AI Comment UX**: Comments appear inline in diff viewer with accept/reject/edit per comment. Batch submit.
- **Diff Viewer**: Full GitHub-like experience. `@git-diff-view/svelte` library chosen (requires Svelte 5).
- **Review Workflow**: Full pending review → batch comments → submit as Approve / Request Changes / Comment.
- **Svelte 5 Upgrade**: User chose to upgrade whole app to Svelte 5 (existing components work in legacy mode).
- **Tests**: Tests after implementation. Vitest + cargo test.

**Research Findings**:
- `@git-diff-view/svelte` (MIT, 631 stars) provides split+unified views, syntax highlighting via shiki, dark theme, Svelte 5 native
- GitHub REST API: `GET /search/issues?q=review-requested:{user}+type:pr+state:open` for PR discovery
- `GET /pulls/{n}/files` returns patch field but NOT full file content — need lazy-fetch via `GET /repos/{owner}/{repo}/git/blobs/{sha}` for syntax highlighting
- Single-request review submission: `POST /pulls/{n}/reviews` with `event` + `body` + `comments[]` — no need for separate pending review creation
- Existing `github_client.rs` has PAT auth, list_open_prs, get_pr_details, get_pr_comments, post_pr_comment already
- Existing orchestrator has session-based checkpoint flow that can be adapted for AI review workflow

### Metis Review
**Identified Gaps** (addressed):
- **Svelte 5 compatibility**: @git-diff-view/svelte requires Svelte 5 → user agreed to full upgrade
- **File content for highlighting**: GitHub patch field lacks full file content → two-tier rendering (immediate with hunks, lazy-fetch for highlighting)
- **Review PRs are NOT task-linked**: Current PR storage links to tickets. Review PRs are standalone → separate `review_prs` table
- **Review API simplification**: Single POST /pulls/{n}/reviews with body+comments+event. No need for multi-step pending review API
- **Rate limiting**: Fetching file content is 2 API calls per file. Lazy-fetch on file expand, not all upfront. Cache in runtime Map.
- **Edge cases**: Binary files (show "Binary file changed"), large PRs (100+ files need pagination), draft PRs (show but mark as draft), empty states

---

## Work Objectives

### Core Objective
Build a complete GitHub PR review experience — from PR discovery to AI-assisted code review to submitting formal reviews — as a new top-level view in the app.

### Concrete Deliverables
- Svelte 5 upgraded app with all existing components working
- `PrReviewView.svelte` — new top-level view with PR list + PR detail
- `DiffViewer.svelte` — wrapper around @git-diff-view/svelte with comment overlay
- `FileTree.svelte` — navigable file tree with change indicators
- AI review flow via OpenCode producing inline + summary comments
- Review submission (Approve / Request Changes / Comment) with batched inline comments
- Notification badge on PR Review nav item when new review requests arrive
- 6+ new Rust API methods in github_client.rs
- 4+ new Tauri commands
- New `review_prs`, `review_pr_files`, `review_pr_comments`, `ai_review_comments` DB tables
- Extended orchestrator for AI review workflow

### Definition of Done
- [ ] `npm run build` passes with zero errors
- [ ] `npm run test` passes (all existing + new tests)
- [ ] `cargo test` passes (all existing + new tests)
- [ ] Can view PRs requesting review across multiple repos
- [ ] Can open a PR and see full diff with syntax highlighting
- [ ] Can trigger AI review and see inline comments appear in diff
- [ ] Can accept/reject/edit AI comments and submit as GitHub review
- [ ] Can add manual comments on any diff line and include in review

### Must Have
- PRs fetched across all repos (not just one default repo)
- Diff viewer with unified + split toggle
- Syntax highlighting (lazy-loaded per file)
- Click-to-comment on any diff line
- AI review produces summary + inline comments
- Per-comment accept/reject/edit before posting
- Formal review submission (Approve / Request Changes / Comment)
- File tree sidebar with change indicators (+/- counts)
- Empty states for no PRs, no files, no comments
- Notification badge on nav item

### Must NOT Have (Guardrails)
- NO merge/squash/rebase buttons (review only, not merge)
- NO CI/CD status checks display
- NO PR creation from the app
- NO conflict resolution UI
- NO GraphQL — stay with REST API (consistent with existing client)
- NO comment threading (flat comments only — threading is scope creep)
- NO review history view (only current review, not past reviews)
- NO AI prompt tuning UI (hardcoded prompt, iterate later)
- NO cross-repo notification preferences (notify for all repos uniformly)
- NO migrating existing Svelte 4 components to runes syntax (legacy mode is fine)
- NO full file content pre-fetching (lazy-fetch per file only)
- NO custom syntax highlighting engine (use @git-diff-view's built-in shiki)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest + cargo test)
- **Automated tests**: YES (tests after implementation)
- **Framework**: vitest (frontend), cargo test (backend)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Frontend/UI | Playwright (playwright skill) | Navigate, interact, assert DOM, screenshot |
| Rust API methods | Bash (cargo test) | Unit tests with mock HTTP responses |
| Tauri commands | Bash (cargo test + npm test) | Integration through IPC mocks |
| Full flow | Playwright | End-to-end PR review workflow |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — Svelte 5 + types + schema):
├── Task 1: Svelte 5 upgrade + verify existing app works [deep]
├── Task 2: TypeScript types for review data [quick]
├── Task 3: Rust structs + DB schema for review data [quick]
├── Task 4: Top-bar view switcher (Board | PR Review | Settings) [quick]
└── Task 5: Install @git-diff-view/svelte + verify import works [quick]

Wave 2 (Backend API — all independent, MAX PARALLEL):
├── Task 6: GET /user endpoint + username caching [quick]
├── Task 7: Search API — fetch review-requested PRs [unspecified-high]
├── Task 8: GET /pulls/{n}/files — fetch PR file diffs [quick]
├── Task 9: GET /repos/{owner}/{repo}/git/blobs/{sha} — fetch file content [quick]
├── Task 10: GET /pulls/{n}/comments — fetch review comments (extended) [quick]
├── Task 11: POST /pulls/{n}/reviews — submit review with comments [unspecified-high]
└── Task 12: Tauri commands for all new API methods [unspecified-high]

Wave 3 (Frontend views — parallel UI work):
├── Task 13: PR list view + PR card component [visual-engineering]
├── Task 14: File tree sidebar component [visual-engineering]
├── Task 15: Diff viewer wrapper with @git-diff-view + lazy file content loading [deep]
├── Task 16: Click-to-comment overlay + comment form [visual-engineering]
├── Task 17: Review submission panel (Approve / Request Changes / Comment) [visual-engineering]
└── Task 18: PR notification badge + polling extension [quick]

Wave 4 (AI Review + Integration):
├── Task 19: AI review orchestrator flow (OpenCode session for diff review) [deep]
├── Task 20: AI comment display in diff viewer (accept/reject/edit inline) [deep]
├── Task 21: Review assembly — collect accepted AI + manual comments → submit [unspecified-high]
└── Task 22: PR detail view — assemble all sub-components [visual-engineering]

Wave 5 (Tests + QA):
├── Task 23: Frontend tests (vitest) for new components [unspecified-high]
├── Task 24: Rust tests (cargo test) for new API methods + DB [unspecified-high]
└── Task 25: End-to-end integration test [deep]

Wave FINAL (Independent review — 4 parallel):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA via Playwright [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 5 → Task 15 → Task 20 → Task 22 → Task 25 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 (Svelte 5) | — | 4, 5, 13-18 | 1 |
| 2 (TS types) | — | 7, 12, 13, 15, 19 | 1 |
| 3 (Rust structs + DB) | — | 6-12, 19, 24 | 1 |
| 4 (View switcher) | 1 | 13, 22 | 1 |
| 5 (@git-diff-view install) | 1 | 15 | 1 |
| 6 (GET /user) | 3 | 7 | 2 |
| 7 (Search API) | 3, 6 | 12, 13 | 2 |
| 8 (PR files) | 3 | 12, 14, 15 | 2 |
| 9 (Blob content) | 3 | 12, 15 | 2 |
| 10 (Review comments) | 3 | 12, 16 | 2 |
| 11 (Submit review) | 3 | 12, 21 | 2 |
| 12 (Tauri commands) | 7, 8, 9, 10, 11 | 13-22 | 2 |
| 13 (PR list view) | 1, 2, 4, 12 | 22 | 3 |
| 14 (File tree) | 1, 8, 12 | 22 | 3 |
| 15 (Diff viewer) | 1, 2, 5, 8, 9, 12 | 16, 20, 22 | 3 |
| 16 (Click-to-comment) | 1, 10, 15 | 20, 21, 22 | 3 |
| 17 (Review submit panel) | 1 | 21, 22 | 3 |
| 18 (Notification badge) | 1, 12 | 22 | 3 |
| 19 (AI orchestrator) | 2, 3, 8, 9, 12 | 20 | 4 |
| 20 (AI comment display) | 15, 16, 19 | 21, 22 | 4 |
| 21 (Review assembly) | 11, 16, 17, 20 | 22 | 4 |
| 22 (PR detail view) | 13-18, 20, 21 | 25 | 4 |
| 23 (Frontend tests) | 13-22 | F2 | 5 |
| 24 (Rust tests) | 3, 6-12 | F2 | 5 |
| 25 (E2E test) | 22 | F1-F4 | 5 |
| F1-F4 | 25 | — | FINAL |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|----------------------|
| 1 | **5** | T1 → `deep`, T2-T5 → `quick` |
| 2 | **7** | T6 → `quick`, T7 → `unspecified-high`, T8-T10 → `quick`, T11 → `unspecified-high`, T12 → `unspecified-high` |
| 3 | **6** | T13-T14 → `visual-engineering`, T15 → `deep`, T16-T17 → `visual-engineering`, T18 → `quick` |
| 4 | **4** | T19-T20 → `deep`, T21 → `unspecified-high`, T22 → `visual-engineering` |
| 5 | **3** | T23-T24 → `unspecified-high`, T25 → `deep` |
| FINAL | **4** | F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [ ] 1. Svelte 5 Upgrade

  **What to do**:
  - Upgrade `svelte` from `^4.2.8` to `^5.0.0` in package.json
  - Upgrade `@sveltejs/vite-plugin-svelte` to Svelte 5-compatible version
  - Upgrade `svelte-check` and `tsconfig` if needed
  - Run `npm install` and resolve any peer dependency conflicts
  - Run `npm run build` — fix any compilation errors
  - Run `npm run test` — fix any test failures
  - Run `npm run dev` and verify the existing Kanban board UI works (renders, interactions, data loading)
  - Do NOT rewrite existing components to use runes — legacy mode is fine
  - Only fix what breaks, don't refactor

  **Must NOT do**:
  - Do NOT migrate existing components to Svelte 5 runes syntax ($props, $state, $derived)
  - Do NOT change component API signatures
  - Do NOT touch Rust backend
  - Do NOT add new features — this is purely an upgrade task

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Svelte 5 upgrade may have subtle breaking changes requiring careful debugging across the full app
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Svelte expertise for identifying and fixing component-level issues
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed — visual verification is simple (does it render?)

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2, 3)
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 13-18 (all frontend work)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `package.json` — Current Svelte version and all dependencies to upgrade
  - `vite.config.ts` — Vite plugin config that may need updating
  - `tsconfig.json` — TypeScript config, check `compilerOptions` compatibility
  - `svelte.config.js` — Svelte compiler config if it exists

  **External References**:
  - Svelte 5 migration guide: `https://svelte.dev/docs/svelte/v5-migration-guide`
  - Svelte 5 legacy mode docs (existing components run without changes)

  **WHY Each Reference Matters**:
  - `package.json`: Source of truth for current versions. All Svelte-related deps need coordinated upgrade.
  - `vite.config.ts`: The Vite plugin version must match Svelte 5.
  - Migration guide: Lists all breaking changes and how to handle them in legacy mode.

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0 with no errors
  - [ ] `npm run test` — all existing tests pass
  - [ ] `npm run dev` starts successfully on port 1420
  - [ ] Svelte version in package.json is `^5.0.0`

  **QA Scenarios**:

  ```
  Scenario: Existing Kanban board renders correctly after Svelte 5 upgrade
    Tool: Playwright (playwright skill)
    Preconditions: App built and dev server running on http://localhost:1420
    Steps:
      1. Navigate to http://localhost:1420
      2. Wait for `.kanban-board` selector to appear (timeout: 10s)
      3. Assert: at least 3 `.column` elements exist (todo, in_progress, done columns)
      4. Assert: page has no console errors (listen for console.error events)
      5. Screenshot full page
    Expected Result: Kanban board renders with all columns, no JS errors
    Failure Indicators: Missing columns, console errors, blank page, hydration errors
    Evidence: .sisyphus/evidence/task-1-kanban-renders.png

  Scenario: Settings view still works
    Tool: Playwright (playwright skill)
    Preconditions: App running on http://localhost:1420
    Steps:
      1. Navigate to http://localhost:1420
      2. Click element with text "Settings" or gear icon button
      3. Wait for settings panel to appear
      4. Assert: settings form fields are visible
      5. Screenshot
    Expected Result: Settings panel opens and displays config fields
    Failure Indicators: Settings panel doesn't open, crash, blank content
    Evidence: .sisyphus/evidence/task-1-settings-works.png
  ```

  **Commit**: YES
  - Message: `chore: upgrade Svelte from v4 to v5`
  - Files: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, any component fixes
  - Pre-commit: `npm run build && npm run test`

---

- [ ] 2. TypeScript Types for Review Data

  **What to do**:
  - Add new interfaces to `src/lib/types.ts` for the PR review feature:
    ```typescript
    export interface ReviewPullRequest {
      id: number;
      number: number;
      repo_owner: string;
      repo_name: string;
      title: string;
      body: string | null;
      author: string;
      state: string;
      draft: boolean;
      html_url: string;
      head_sha: string;
      base_ref: string;
      additions: number;
      deletions: number;
      changed_files: number;
      created_at: string;
      updated_at: string;
    }

    export interface PrFileDiff {
      sha: string;
      filename: string;
      status: string; // added | removed | modified | renamed
      additions: number;
      deletions: number;
      changes: number;
      patch: string | null;
      previous_filename: string | null;
      content: string | null; // lazy-loaded file content for highlighting
    }

    export interface ReviewComment {
      id: number;
      pr_number: number;
      repo_owner: string;
      repo_name: string;
      path: string;
      line: number | null;
      side: string | null; // LEFT | RIGHT
      body: string;
      author: string;
      created_at: string;
      in_reply_to_id: number | null;
    }

    export interface AiReviewComment {
      id: string; // client-generated UUID
      path: string;
      line: number;
      side: string; // LEFT | RIGHT
      body: string;
      status: 'pending' | 'accepted' | 'rejected' | 'edited';
      original_body: string; // original AI text before edits
    }

    export interface ReviewSubmission {
      event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
      body: string; // review summary
      comments: ReviewSubmissionComment[];
    }

    export interface ReviewSubmissionComment {
      path: string;
      line: number;
      side: string;
      body: string;
    }

    export type AppView = 'board' | 'pr-review' | 'settings';
    ```
  - Add new stores to `src/lib/stores.ts`:
    ```typescript
    export const currentView = writable<AppView>('board');
    export const reviewPrs = writable<ReviewPullRequest[]>([]);
    export const selectedReviewPr = writable<ReviewPullRequest | null>(null);
    export const prFileDiffs = writable<PrFileDiff[]>([]);
    export const aiReviewComments = writable<AiReviewComment[]>([]);
    export const pendingManualComments = writable<ReviewSubmissionComment[]>([]);
    export const reviewRequestCount = writable<number>(0);
    ```

  **Must NOT do**:
  - Do NOT modify existing types (Ticket, PullRequestInfo, etc.)
  - Do NOT remove any existing stores
  - Do NOT add IPC wrappers yet (that's Task 12)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions — no logic, no ambiguity
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed for type-only work

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 7, 12, 13, 15, 19
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/types.ts` — Follow existing interface patterns (PullRequestInfo, PrComment). Use `interface` for objects, `type` for unions. Nullable fields use `T | null`.
  - `src/lib/stores.ts` — Follow existing store patterns (writable with typed generics)

  **API/Type References**:
  - GitHub REST API PR response: `number`, `title`, `body`, `user.login`, `state`, `draft`, `html_url`, `head.sha`, `base.ref`, `additions`, `deletions`, `changed_files`
  - GitHub PR files response: `sha`, `filename`, `status`, `additions`, `deletions`, `changes`, `patch`, `previous_filename`
  - GitHub review comment: `id`, `path`, `line`, `side`, `body`, `user.login`, `created_at`, `in_reply_to_id`

  **WHY Each Reference Matters**:
  - `types.ts`: Must match the exact naming/style conventions (camelCase for TS, snake_case from Rust serialization)
  - GitHub API shapes: Types must match what Rust will serialize from API responses

  **Acceptance Criteria**:
  - [ ] `npm run build` exits 0
  - [ ] All new types exported from `src/lib/types.ts`
  - [ ] All new stores exported from `src/lib/stores.ts`
  - [ ] No unused type warnings

  **QA Scenarios**:

  ```
  Scenario: Types compile without errors
    Tool: Bash
    Preconditions: npm dependencies installed
    Steps:
      1. Run: npx svelte-check --output human
      2. Assert: exit code 0
      3. Assert: no errors mentioning new type names
    Expected Result: Zero type errors
    Failure Indicators: Type errors, missing exports, circular dependencies
    Evidence: .sisyphus/evidence/task-2-typecheck.txt

  Scenario: Stores are importable and usable
    Tool: Bash
    Preconditions: Types and stores defined
    Steps:
      1. Run: npx vitest run --reporter=verbose 2>&1 | head -20
      2. Assert: no import errors for new stores
    Expected Result: Existing tests still pass (no import breakage)
    Evidence: .sisyphus/evidence/task-2-stores-import.txt
  ```

  **Commit**: YES
  - Message: `feat(types): add TypeScript types and stores for PR review feature`
  - Files: `src/lib/types.ts`, `src/lib/stores.ts`
  - Pre-commit: `npm run build`

---

- [ ] 3. Rust Structs + DB Schema for Review Data

  **What to do**:
  - Add new structs to `src-tauri/src/github_client.rs`:
    ```rust
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ReviewPullRequest {
        pub id: i64,
        pub number: i64,
        pub title: String,
        pub body: Option<String>,
        pub state: String,
        pub draft: bool,
        pub html_url: String,
        pub user: GitHubUser,
        pub head: GitHubHead,
        pub base: GitHubBase,
        pub additions: Option<i64>,
        pub deletions: Option<i64>,
        pub changed_files: Option<i64>,
        pub requested_reviewers: Vec<GitHubUser>,
        pub created_at: String,
        pub updated_at: String,
        #[serde(flatten)]
        pub extra: serde_json::Value,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GitHubBase {
        #[serde(rename = "ref")]
        pub ref_name: String,
        pub sha: String,
        #[serde(flatten)]
        pub extra: serde_json::Value,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct PullRequestFile {
        pub sha: String,
        pub filename: String,
        pub status: String,
        pub additions: i64,
        pub deletions: i64,
        pub changes: i64,
        pub patch: Option<String>,
        pub previous_filename: Option<String>,
        #[serde(flatten)]
        pub extra: serde_json::Value,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct GitHubReviewComment {
        pub id: i64,
        pub path: String,
        pub line: Option<i32>,
        pub side: Option<String>,
        pub body: String,
        pub user: GitHubUser,
        pub created_at: String,
        pub in_reply_to_id: Option<i64>,
        #[serde(flatten)]
        pub extra: serde_json::Value,
    }
    ```
  - Add new DB tables in `src-tauri/src/db.rs`:
    ```sql
    CREATE TABLE IF NOT EXISTS review_prs (
        id INTEGER PRIMARY KEY,
        number INTEGER NOT NULL,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        author TEXT NOT NULL,
        state TEXT NOT NULL,
        draft INTEGER NOT NULL DEFAULT 0,
        html_url TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        base_ref TEXT NOT NULL,
        additions INTEGER NOT NULL DEFAULT 0,
        deletions INTEGER NOT NULL DEFAULT 0,
        changed_files INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_pr_comments (
        id INTEGER PRIMARY KEY,
        pr_id INTEGER NOT NULL,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        path TEXT NOT NULL,
        line INTEGER,
        side TEXT,
        body TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TEXT NOT NULL,
        in_reply_to_id INTEGER,
        FOREIGN KEY (pr_id) REFERENCES review_prs(id)
    );
    ```
  - Add corresponding Row structs (ReviewPrRow, ReviewPrCommentRow) following existing PrRow/PrCommentRow pattern
  - Add CRUD methods: `insert_review_pr`, `get_review_prs`, `get_review_pr_by_number`, `insert_review_pr_comment`, `get_review_pr_comments`, `delete_stale_review_prs`

  **Must NOT do**:
  - Do NOT modify existing `pull_requests` or `pr_comments` tables
  - Do NOT add Tauri commands yet (that's Task 12)
  - Do NOT add API client methods yet (that's Tasks 6-11)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definitions and CRUD — follows existing patterns exactly
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `golang`: Wrong language

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6-12, 19, 24
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src-tauri/src/db.rs:PrRow` (struct around line 70-80) — Follow exact pattern for ReviewPrRow: public fields, Debug+Clone+Serialize derives
  - `src-tauri/src/db.rs:PrCommentRow` — Follow for ReviewPrCommentRow
  - `src-tauri/src/db.rs:insert_pull_request()` — Follow SQL insert pattern with `params![]` macro
  - `src-tauri/src/db.rs:get_open_prs()` — Follow query pattern with `query_map` and struct construction

  **API/Type References**:
  - `src-tauri/src/github_client.rs:PullRequest` — Existing PR struct to reference for serde patterns (especially `#[serde(flatten)]` for extra fields)
  - `src-tauri/src/github_client.rs:GitHubUser` — Reuse existing user struct
  - `src-tauri/src/github_client.rs:GitHubHead` — Reuse existing head struct

  **WHY Each Reference Matters**:
  - `db.rs` patterns: The CRUD methods must follow the exact same `Arc<Mutex<Connection>>` locking, `params![]` macro, and `query_map` patterns
  - `github_client.rs` structs: Must use `#[serde(flatten)] pub extra: serde_json::Value` on all API response types (project convention)

  **Acceptance Criteria**:
  - [ ] `cargo build` exits 0
  - [ ] `cargo test` — all existing tests pass
  - [ ] New tables created on app startup (migration in Database::new)
  - [ ] All CRUD methods have doc comments (project convention)

  **QA Scenarios**:

  ```
  Scenario: Database tables created and CRUD works
    Tool: Bash
    Preconditions: Rust project compiles
    Steps:
      1. Run: cargo test test_review_pr_operations -- --nocapture
      2. Assert: test passes — insert, query, and delete work
    Expected Result: CRUD operations work on both review_prs and review_pr_comments tables
    Failure Indicators: SQL errors, missing columns, type mismatches
    Evidence: .sisyphus/evidence/task-3-db-crud.txt

  Scenario: Existing database tests still pass
    Tool: Bash
    Preconditions: cargo build succeeds
    Steps:
      1. Run: cargo test db::tests -- --nocapture
      2. Assert: all existing db tests pass
    Expected Result: Zero regressions in existing database functionality
    Evidence: .sisyphus/evidence/task-3-existing-tests.txt
  ```

  **Commit**: YES
  - Message: `feat(db): add Rust structs and DB schema for PR review data`
  - Files: `src-tauri/src/github_client.rs`, `src-tauri/src/db.rs`
  - Pre-commit: `cargo build && cargo test`

---

- [ ] 4. Top-Bar View Switcher (Board | PR Review | Settings)

  **What to do**:
  - Replace `showSettings` boolean in App.svelte with `currentView` store usage
  - Add view switcher buttons/tabs in the top bar: Board | PR Review | Settings
  - Conditionally render: KanbanBoard (board), PrReviewView placeholder (pr-review), SettingsPanel (settings)
  - Create a minimal `PrReviewView.svelte` placeholder (empty div with "PR Review — coming soon" text)
  - Style the active tab to match existing Tokyo Night dark theme
  - Add notification badge placeholder on PR Review tab (just the visual, no count logic yet)
  - Import and use `currentView` store from stores.ts

  **Must NOT do**:
  - Do NOT implement PR review functionality yet (placeholder only)
  - Do NOT use a router library — simple conditional rendering with `{#if}` blocks
  - Do NOT change the DetailPanel behavior (it still slides in for the board view)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple UI change — replace a boolean toggle with a 3-way switcher
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Styling the tab switcher to match existing theme
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for this simple UI change

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after Task 1 completes)
  - **Blocks**: Tasks 13, 22
  - **Blocked By**: Task 1 (Svelte 5 upgrade)

  **References**:

  **Pattern References**:
  - `src/App.svelte` — The `showSettings` boolean pattern and conditional rendering. Replace with `$currentView === 'settings'` etc.
  - `src/App.svelte` — Top bar area where settings toggle currently lives. Place view switcher here.
  - `src/components/DetailPanel.svelte` — Tab pattern (`activeTab` with `class:active`) — reuse same styling approach for view switcher

  **API/Type References**:
  - `src/lib/types.ts:AppView` — The `'board' | 'pr-review' | 'settings'` type (from Task 2)
  - `src/lib/stores.ts:currentView` — The store to import (from Task 2)

  **WHY Each Reference Matters**:
  - `App.svelte`: This is THE file being modified. Understand the layout, event listeners, and conditional rendering.
  - `DetailPanel.svelte` tab pattern: Reuse the exact same `class:active` CSS pattern for visual consistency.

  **Acceptance Criteria**:
  - [ ] Three view tabs visible in top bar: Board, PR Review, Settings
  - [ ] Clicking each tab switches the view
  - [ ] Board view shows KanbanBoard (default)
  - [ ] PR Review tab shows placeholder component
  - [ ] Settings tab shows SettingsPanel
  - [ ] Active tab is visually distinguished
  - [ ] `npm run build` exits 0

  **QA Scenarios**:

  ```
  Scenario: View switching works between all three views
    Tool: Playwright (playwright skill)
    Preconditions: App running on http://localhost:1420
    Steps:
      1. Navigate to http://localhost:1420
      2. Assert: `.kanban-board` is visible (default board view)
      3. Click element containing text "PR Review"
      4. Assert: `.kanban-board` is NOT visible
      5. Assert: text "PR Review" content area is visible
      6. Click element containing text "Settings"
      7. Assert: settings panel is visible
      8. Click element containing text "Board"
      9. Assert: `.kanban-board` is visible again
      10. Screenshot each state
    Expected Result: All three views render correctly, only one visible at a time
    Failure Indicators: Multiple views visible simultaneously, click not switching, blank content
    Evidence: .sisyphus/evidence/task-4-view-switcher.png

  Scenario: Default view is Board on app load
    Tool: Playwright (playwright skill)
    Preconditions: Fresh app load
    Steps:
      1. Navigate to http://localhost:1420
      2. Assert: Board tab has active styling
      3. Assert: `.kanban-board` is visible
    Expected Result: Board is the default active view
    Evidence: .sisyphus/evidence/task-4-default-view.png
  ```

  **Commit**: YES
  - Message: `feat(nav): add top-bar view switcher for Board, PR Review, Settings`
  - Files: `src/App.svelte`, `src/components/PrReviewView.svelte` (placeholder)
  - Pre-commit: `npm run build`

---

- [ ] 5. Install @git-diff-view/svelte and Verify Import

  **What to do**:
  - Run `npm install @git-diff-view/svelte @git-diff-view/file`
  - Verify peer dependency resolution (Svelte 5 must be installed from Task 1)
  - Create a minimal test: import `DiffView` and `DiffModeEnum` in a throwaway script and verify no errors
  - Verify the CSS import works: `import '@git-diff-view/svelte/styles/diff-view.css'`
  - Check that `DiffFile` from `@git-diff-view/file` can be imported and constructed
  - Remove the throwaway test file after verification

  **Must NOT do**:
  - Do NOT build any UI components with it yet
  - Do NOT integrate into the app — just verify the dependency works

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple dependency installation + smoke test
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after Task 1 completes)
  - **Blocks**: Task 15 (Diff viewer wrapper)
  - **Blocked By**: Task 1 (Svelte 5 upgrade)

  **References**:

  **External References**:
  - `@git-diff-view/svelte` npm package: `https://www.npmjs.com/package/@git-diff-view/svelte`
  - `@git-diff-view/file` npm package: `https://www.npmjs.com/package/@git-diff-view/file`
  - Library repo: `https://github.com/MrWangJustToDo/git-diff-view`

  **WHY Each Reference Matters**:
  - npm pages: Verify latest version, peer deps, and import paths
  - Repo: README has usage examples and API reference

  **Acceptance Criteria**:
  - [ ] `npm install` completes without peer dep warnings for svelte
  - [ ] `npm run build` exits 0
  - [ ] `DiffView`, `DiffModeEnum`, and `DiffFile` are importable without errors

  **QA Scenarios**:

  ```
  Scenario: Library installs and imports cleanly
    Tool: Bash
    Preconditions: Svelte 5 installed (Task 1 complete)
    Steps:
      1. Run: npm ls @git-diff-view/svelte
      2. Assert: package is listed with no peer dep errors
      3. Run: npm run build
      4. Assert: exit code 0
    Expected Result: Library installed, app builds, no import errors
    Failure Indicators: Peer dependency errors, build failures mentioning @git-diff-view
    Evidence: .sisyphus/evidence/task-5-lib-install.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `chore(deps): install @git-diff-view/svelte for diff rendering`
  - Files: `package.json`, `package-lock.json`
  - Pre-commit: `npm run build`

---

- [ ] 6. GET /user Endpoint + Username Caching

  **What to do**:
  - Add method to `github_client.rs`: `get_authenticated_user(token) -> Result<String, GitHubError>` that calls `GET /user` and returns `login` field
  - Add `get_github_username()` DB method that checks config table for cached `github_username`
  - Add `set_github_username()` DB method to cache it
  - In the poller or on-demand: if `github_username` config is empty, call `get_authenticated_user()` and cache result
  - Add a Tauri command `get_github_username` that returns the cached username (fetching if needed)

  **Must NOT do**:
  - Do NOT add a manual username config field — auto-detect only
  - Do NOT call GET /user on every poll cycle (cache it)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single API call + simple caching logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7-11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 7 (Search API needs username)
  - **Blocked By**: Task 3 (DB methods)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:get_pr_details()` — Follow HTTP request pattern: reqwest client, Authorization header, User-Agent, JSON deserialization
  - `src-tauri/src/db.rs:get_config()` / `set_config()` — Config caching pattern already exists

  **External References**:
  - GitHub API: `GET /user` — Returns `{ "login": "username", ... }`

  **WHY Each Reference Matters**:
  - `get_pr_details()`: Exact reqwest pattern to copy (headers, error handling, deserialization)
  - `get_config()`/`set_config()`: The caching mechanism already exists — just use key `github_username`

  **Acceptance Criteria**:
  - [ ] `cargo test test_get_authenticated_user` passes
  - [ ] Username cached in config table after first fetch
  - [ ] Subsequent calls return cached value without API call

  **QA Scenarios**:

  ```
  Scenario: Username auto-detection works
    Tool: Bash
    Preconditions: Valid github_token configured
    Steps:
      1. Run: cargo test test_get_authenticated_user -- --nocapture
      2. Assert: test passes, username is non-empty string
    Expected Result: GET /user returns valid username
    Evidence: .sisyphus/evidence/task-6-username.txt

  Scenario: Username is cached after first fetch
    Tool: Bash
    Preconditions: github_token configured, github_username NOT in config
    Steps:
      1. Run: cargo test test_username_caching -- --nocapture
      2. Assert: first call fetches from API, second call returns from cache
    Expected Result: Only one API call made for multiple username lookups
    Evidence: .sisyphus/evidence/task-6-caching.txt
  ```

  **Commit**: YES
  - Message: `feat(github): auto-detect GitHub username from PAT`
  - Files: `src-tauri/src/github_client.rs`, `src-tauri/src/db.rs`, `src-tauri/src/main.rs`
  - Pre-commit: `cargo build`

---

- [ ] 7. Search API — Fetch Review-Requested PRs

  **What to do**:
  - Add method to `github_client.rs`: `search_review_requested_prs(username, token) -> Result<Vec<ReviewPullRequest>, GitHubError>`
  - Endpoint: `GET /search/issues?q=review-requested:{username}+type:pr+state:open&per_page=100`
  - Parse search results — each item contains PR data but some fields (additions, deletions) require a follow-up `GET /repos/{owner}/{repo}/pulls/{number}` call
  - Implement pagination (check `total_count` vs items returned, follow `page` param)
  - Extract `repo_owner` and `repo_name` from the `repository_url` field in search results
  - For each search result, fetch full PR details to get `additions`, `deletions`, `changed_files`, `draft`, `head.sha`, `base.ref`
  - Rate limit consideration: batch detail fetches, max 10 concurrent

  **Must NOT do**:
  - Do NOT use GraphQL (stay with REST)
  - Do NOT poll automatically yet (that's Task 18)
  - Do NOT store results in DB yet (that's Task 12's command)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Involves pagination, rate limiting, and mapping between search results and full PR objects — non-trivial API orchestration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8-11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12 (Tauri commands)
  - **Blocked By**: Tasks 3 (structs), 6 (username)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:list_open_prs()` — Existing PR list method. Follow same reqwest + serde pattern but with different endpoint.
  - `src-tauri/src/github_client.rs:get_pr_details()` — Will be called for each search result to get full PR data.

  **External References**:
  - GitHub Search API: `GET /search/issues?q=review-requested:{username}+type:pr+state:open`
  - Search response shape: `{ "total_count": N, "items": [...] }` where items are issue/PR objects
  - Note: Search results have `pull_request.url` field to get full PR details

  **WHY Each Reference Matters**:
  - `list_open_prs()`: The pattern for paginated PR fetching. Adapt for search endpoint.
  - `get_pr_details()`: Called per search result to enrich with full PR data (additions, draft, head sha).

  **Acceptance Criteria**:
  - [ ] Method returns PRs from multiple repos
  - [ ] Each PR has complete data (additions, deletions, head_sha, base_ref)
  - [ ] Pagination works for users with 100+ review requests
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Search returns review-requested PRs
    Tool: Bash
    Preconditions: Valid github_token, user has pending review requests
    Steps:
      1. Run: cargo test test_search_review_requested -- --nocapture
      2. Assert: returns Vec with at least 1 PR
      3. Assert: each PR has repo_owner, repo_name, head_sha populated
    Expected Result: PRs from potentially multiple repos returned with full data
    Failure Indicators: Empty results, missing fields, auth errors
    Evidence: .sisyphus/evidence/task-7-search-prs.txt

  Scenario: Search handles zero results gracefully
    Tool: Bash
    Preconditions: Mock or use a username with no review requests
    Steps:
      1. Run: cargo test test_search_no_results -- --nocapture
      2. Assert: returns empty Vec, no error
    Expected Result: Graceful empty state, not an error
    Evidence: .sisyphus/evidence/task-7-empty-search.txt
  ```

  **Commit**: YES
  - Message: `feat(github): search for PRs requesting user review across all repos`
  - Files: `src-tauri/src/github_client.rs`
  - Pre-commit: `cargo build`

---

- [ ] 8. GET /pulls/{n}/files — Fetch PR File Diffs

  **What to do**:
  - Add method: `get_pr_files(owner, repo, pr_number, token) -> Result<Vec<PullRequestFile>, GitHubError>`
  - Endpoint: `GET /repos/{owner}/{repo}/pulls/{pull_number}/files?per_page=100`
  - Handle pagination for large PRs (100+ files)
  - Handle missing `patch` field (binary files return null patch)

  **Must NOT do**:
  - Do NOT fetch file contents here (that's Task 9)
  - Do NOT cache results in DB (files are transient, fetched on demand)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple paginated GET endpoint, follows existing patterns exactly
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6, 7, 9-11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 14, 15
  - **Blocked By**: Task 3 (structs)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:get_pr_comments()` — Paginated GET pattern to follow

  **External References**:
  - GitHub API: `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
  - Response: array of `{ sha, filename, status, additions, deletions, changes, patch, previous_filename }`

  **Acceptance Criteria**:
  - [ ] Returns file list with patch data for modified files
  - [ ] Binary files return with `patch: None`
  - [ ] Renamed files include `previous_filename`
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: File diffs fetched for a PR
    Tool: Bash
    Preconditions: Valid token, known PR with file changes
    Steps:
      1. Run: cargo test test_get_pr_files -- --nocapture
      2. Assert: returns non-empty Vec of PullRequestFile
      3. Assert: at least one file has non-null patch field
    Expected Result: File list with diff patches returned
    Evidence: .sisyphus/evidence/task-8-pr-files.txt
  ```

  **Commit**: YES (groups with Tasks 9-10)
  - Message: `feat(github): add PR file diff and blob content fetching`
  - Files: `src-tauri/src/github_client.rs`
  - Pre-commit: `cargo build`

---

- [ ] 9. GET /repos/{owner}/{repo}/git/blobs/{sha} — Fetch File Content

  **What to do**:
  - Add method: `get_blob_content(owner, repo, sha, token) -> Result<String, GitHubError>`
  - Endpoint: `GET /repos/{owner}/{repo}/git/blobs/{sha}`
  - Response contains `content` (Base64 encoded) and `encoding` field
  - Decode Base64 content to UTF-8 string
  - Handle non-UTF-8 content gracefully (return error or placeholder)
  - Add method: `get_file_at_ref(owner, repo, path, ref_sha, token) -> Result<String, GitHubError>` for fetching old version of file
  - Endpoint: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}` — returns `content` (Base64) for files

  **Must NOT do**:
  - Do NOT cache blob content in the database (too large, transient)
  - Do NOT fetch proactively — this is called on-demand per file

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two simple GET endpoints with Base64 decoding
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-8, 10-11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 15
  - **Blocked By**: Task 3 (structs)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:get_pr_details()` — HTTP request pattern

  **External References**:
  - GitHub Blobs API: `GET /repos/{owner}/{repo}/git/blobs/{sha}` → `{ content: "base64...", encoding: "base64", size: N }`
  - GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}` → `{ content: "base64...", encoding: "base64" }`

  **WHY Each Reference Matters**:
  - Blobs API: For fetching NEW file version (using sha from PR files endpoint)
  - Contents API: For fetching OLD file version (using base branch ref)

  **Acceptance Criteria**:
  - [ ] `get_blob_content` returns decoded UTF-8 string
  - [ ] `get_file_at_ref` returns file content at specific git ref
  - [ ] Non-UTF-8 / binary content handled gracefully (returns error, not panic)
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Blob content fetched and decoded
    Tool: Bash
    Steps:
      1. Run: cargo test test_get_blob_content -- --nocapture
      2. Assert: returns non-empty string of decoded file content
    Expected Result: Base64 decoded file content as UTF-8 string
    Evidence: .sisyphus/evidence/task-9-blob-content.txt
  ```

  **Commit**: YES (groups with Task 8)
  - Message: `feat(github): add PR file diff and blob content fetching`
  - Files: `src-tauri/src/github_client.rs`
  - Pre-commit: `cargo build`

---

- [ ] 10. GET /pulls/{n}/comments — Extended Review Comments Fetching

  **What to do**:
  - Add method: `get_pr_review_comments(owner, repo, pr_number, token) -> Result<Vec<GitHubReviewComment>, GitHubError>`
  - Endpoint: `GET /repos/{owner}/{repo}/pulls/{pull_number}/comments?per_page=100`
  - This returns inline review comments (with path, line, side) — different from the existing `get_pr_comments` which merges review + issue comments
  - Parse: `id`, `path`, `line`, `side`, `start_line`, `start_side`, `body`, `user.login`, `created_at`, `in_reply_to_id`
  - Handle pagination

  **Must NOT do**:
  - Do NOT modify existing `get_pr_comments()` method (it's used by the Kanban view)
  - Do NOT mix with issue comments — review comments only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Follows exact same pattern as existing comment fetching
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-9, 11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 16
  - **Blocked By**: Task 3 (structs)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:get_pr_comments()` — The existing method fetches both review + issue comments. The new method fetches ONLY review comments with full position data (line, side).

  **External References**:
  - GitHub API: `GET /repos/{owner}/{repo}/pulls/{pull_number}/comments`
  - Response: array of `{ id, path, line, side, start_line, start_side, body, user, created_at, in_reply_to_id, diff_hunk }`

  **Acceptance Criteria**:
  - [ ] Returns review comments with line positioning data
  - [ ] `in_reply_to_id` correctly parsed for threading info
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Review comments fetched with position data
    Tool: Bash
    Steps:
      1. Run: cargo test test_get_pr_review_comments -- --nocapture
      2. Assert: comments have path, line, and side fields
    Expected Result: Positioned review comments returned
    Evidence: .sisyphus/evidence/task-10-review-comments.txt
  ```

  **Commit**: YES
  - Message: `feat(github): fetch positioned review comments for PRs`
  - Files: `src-tauri/src/github_client.rs`
  - Pre-commit: `cargo build`

---

- [ ] 11. POST /pulls/{n}/reviews — Submit Review with Comments

  **What to do**:
  - Add method: `submit_review(owner, repo, pr_number, event, body, comments, commit_id, token) -> Result<(), GitHubError>`
  - Endpoint: `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`
  - Request body:
    ```json
    {
      "commit_id": "sha",
      "event": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      "body": "Review summary",
      "comments": [
        { "path": "file.ts", "line": 10, "side": "RIGHT", "body": "Comment text" }
      ]
    }
    ```
  - This is a single-request approach: create review + comments + submit in one call
  - Handle error responses (422 for invalid line references, 403 for permission issues)

  **Must NOT do**:
  - Do NOT implement multi-step pending review (create → add comments → submit separately)
  - Do NOT implement review deletion or update

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: POST endpoint with complex body, error handling for GitHub-specific validation errors
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 21
  - **Blocked By**: Task 3 (structs)

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_client.rs:post_pr_comment()` — Existing POST method pattern

  **External References**:
  - GitHub API: `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`
  - Event values: `APPROVE`, `REQUEST_CHANGES`, `COMMENT`
  - Error 422: Validation failed (invalid line, path not in diff)

  **Acceptance Criteria**:
  - [ ] Review submitted successfully with comments
  - [ ] All three event types work (APPROVE, REQUEST_CHANGES, COMMENT)
  - [ ] Error 422 returns descriptive error (not generic failure)
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Submit review with inline comments
    Tool: Bash
    Steps:
      1. Run: cargo test test_submit_review -- --nocapture
      2. Assert: review creation returns success (or mock validates correct request body)
    Expected Result: Review POST request correctly formed and accepted
    Evidence: .sisyphus/evidence/task-11-submit-review.txt

  Scenario: Handle invalid line reference gracefully
    Tool: Bash
    Steps:
      1. Run: cargo test test_submit_review_invalid_line -- --nocapture
      2. Assert: returns descriptive GitHubError, not panic
    Expected Result: Graceful error with message about invalid line
    Evidence: .sisyphus/evidence/task-11-invalid-line.txt
  ```

  **Commit**: YES
  - Message: `feat(github): submit PR reviews with batched inline comments`
  - Files: `src-tauri/src/github_client.rs`
  - Pre-commit: `cargo build`

---

- [ ] 12. Tauri Commands for All New API Methods

  **What to do**:
  - Add Tauri commands in `main.rs`:
    - `get_github_username()` → `Result<String, String>` — returns cached or fetched username
    - `fetch_review_prs()` → `Result<Vec<ReviewPrRow>, String>` — search + store + return review PRs
    - `get_review_prs()` → `Result<Vec<ReviewPrRow>, String>` — read from DB only
    - `get_pr_file_diffs(owner, repo, pr_number)` → `Result<Vec<PullRequestFile>, String>` — fetch file diffs
    - `get_file_content(owner, repo, sha)` → `Result<String, String>` — fetch blob content
    - `get_file_at_ref(owner, repo, path, ref_sha)` → `Result<String, String>` — fetch old file version
    - `get_review_comments(owner, repo, pr_number)` → `Result<Vec<GitHubReviewComment>, String>` — fetch positioned comments
    - `submit_pr_review(owner, repo, pr_number, event, body, comments, commit_id)` → `Result<(), String>` — submit review
  - Add new IPC wrappers in `src/lib/ipc.ts`:
    - `getGithubUsername()`, `fetchReviewPrs()`, `getReviewPrs()`, `getPrFileDiffs()`, `getFileContent()`, `getFileAtRef()`, `getReviewComments()`, `submitPrReview()`
  - Register all new commands in the Tauri builder's `invoke_handler` macro
  - `fetch_review_prs` should: call search API → store results in review_prs table → return rows

  **Must NOT do**:
  - Do NOT add UI components (just the command + IPC layer)
  - Do NOT add event emitters yet (that's Task 18)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 8 new commands + 8 IPC wrappers + state management. Touches main.rs (large file) and ipc.ts.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (waits for Wave 2 API work)
  - **Parallel Group**: End of Wave 2 (after Tasks 6-11)
  - **Blocks**: Tasks 13-22 (all frontend + integration)
  - **Blocked By**: Tasks 7, 8, 9, 10, 11

  **References**:

  **Pattern References**:
  - `src-tauri/src/main.rs:get_pull_requests` command — Follow exact pattern: `State<'_, Mutex<db::Database>>`, `State<'_, Mutex<GitHubClient>>`, `.map_err(|e| format!(...))`
  - `src/lib/ipc.ts:getPullRequests()` — Follow pattern: `invoke<ReturnType>("command_name", { param1, param2 })`
  - `src-tauri/src/main.rs` — The `invoke_handler![...]` macro registration list at bottom of setup

  **WHY Each Reference Matters**:
  - `main.rs` commands: The exact State injection and error mapping pattern must be followed
  - `ipc.ts`: TypeScript wrapper pattern with invoke generic for type safety
  - `invoke_handler`: Missing registration = command not found at runtime

  **Acceptance Criteria**:
  - [ ] All 8 commands registered in invoke_handler
  - [ ] All 8 IPC wrappers exported from ipc.ts
  - [ ] `cargo build` exits 0
  - [ ] `npm run build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Commands compile and are registered
    Tool: Bash
    Steps:
      1. Run: cargo build 2>&1
      2. Assert: exit code 0
      3. Run: grep -c "fetch_review_prs\|get_review_prs\|get_pr_file_diffs\|get_file_content\|get_file_at_ref\|get_review_comments\|submit_pr_review\|get_github_username" src-tauri/src/main.rs
      4. Assert: each command name appears at least twice (definition + registration)
    Expected Result: All commands defined and registered
    Evidence: .sisyphus/evidence/task-12-commands.txt

  Scenario: IPC wrappers match commands
    Tool: Bash
    Steps:
      1. Run: grep "export async function" src/lib/ipc.ts | grep -c "getGithubUsername\|fetchReviewPrs\|getReviewPrs\|getPrFileDiffs\|getFileContent\|getFileAtRef\|getReviewComments\|submitPrReview"
      2. Assert: count is 8
      3. Run: npm run build
      4. Assert: exit code 0
    Expected Result: All IPC wrappers exported and app builds
    Evidence: .sisyphus/evidence/task-12-ipc.txt
  ```

  **Commit**: YES
  - Message: `feat(ipc): add Tauri commands and IPC wrappers for PR review`
  - Files: `src-tauri/src/main.rs`, `src/lib/ipc.ts`
  - Pre-commit: `cargo build && npm run build`

---

- [ ] 13. PR List View + PR Card Component

  **What to do**:
  - Create `src/components/PrReviewView.svelte` (replace placeholder from Task 4):
    - Left area: PR list (scrollable, takes remaining space)
    - Right area: PR detail panel (400px, shown when PR selected) — placeholder for now
    - Top: refresh button, PR count, filter by repo dropdown
  - Create `src/components/ReviewPrCard.svelte`:
    - Shows: repo badge (owner/name), PR title, PR number, author, time ago, draft badge
    - Shows: +additions / -deletions count, changed files count
    - Click selects the PR (sets `$selectedReviewPr`)
    - Selected state styling (highlighted border/background)
  - Data loading: on mount, call `fetchReviewPrs()` → store results in `$reviewPrs`
  - Group PRs by repo in the list (collapsible repo headers)
  - Empty state: "No PRs requesting your review" with illustration or icon
  - Loading state: skeleton cards while fetching

  **Must NOT do**:
  - Do NOT implement the detail panel content yet (placeholder)
  - Do NOT implement notification polling yet
  - Do NOT add drag-and-drop or column layout (it's a simple list, not kanban)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: New UI view with cards, grouping, empty states, loading states — heavy visual work
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Styling PR cards and list layout to match existing Tokyo Night theme

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 14-18)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 2, 4, 12

  **References**:

  **Pattern References**:
  - `src/components/KanbanBoard.svelte` — Main view component pattern: flex layout, data loading on mount, store usage
  - `src/components/TicketCard.svelte` — Card component pattern: props, click handlers, CSS styling
  - `src/App.svelte` — How the current board view integrates (conditional rendering, event listeners)

  **API/Type References**:
  - `src/lib/types.ts:ReviewPullRequest` — PR data shape (from Task 2)
  - `src/lib/stores.ts:reviewPrs` — Store to populate
  - `src/lib/stores.ts:selectedReviewPr` — Store for selection
  - `src/lib/ipc.ts:fetchReviewPrs()` — IPC call to fetch data

  **WHY Each Reference Matters**:
  - `KanbanBoard.svelte`: The primary reference for how a "main view" is structured (layout, loading, data flow)
  - `TicketCard.svelte`: Card component pattern to follow for ReviewPrCard styling and interaction

  **Acceptance Criteria**:
  - [ ] PR list renders with cards grouped by repo
  - [ ] Clicking a card selects it (highlighted)
  - [ ] Refresh button triggers `fetchReviewPrs()`
  - [ ] Empty state shown when no PRs
  - [ ] Loading skeletons shown during fetch
  - [ ] `npm run build` exits 0

  **QA Scenarios**:

  ```
  Scenario: PR list displays review-requested PRs
    Tool: Playwright (playwright skill)
    Preconditions: App running, GitHub token configured, user has review requests
    Steps:
      1. Navigate to http://localhost:1420
      2. Click "PR Review" tab in top bar
      3. Wait for `.pr-list` or `.review-pr-card` selector (timeout: 15s)
      4. Assert: at least 1 `.review-pr-card` element exists
      5. Assert: card shows PR title, repo badge, author
      6. Screenshot
    Expected Result: PR cards rendered with correct data
    Failure Indicators: Empty list (despite having review requests), missing data fields, layout broken
    Evidence: .sisyphus/evidence/task-13-pr-list.png

  Scenario: Empty state when no review requests
    Tool: Playwright (playwright skill)
    Preconditions: App running, no pending review requests (or mock empty response)
    Steps:
      1. Navigate to PR Review view
      2. Wait for content to load
      3. Assert: empty state message visible (text "No PRs" or similar)
      4. Screenshot
    Expected Result: Friendly empty state, not blank screen
    Evidence: .sisyphus/evidence/task-13-empty-state.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add PR list view with grouped review-requested PRs`
  - Files: `src/components/PrReviewView.svelte`, `src/components/ReviewPrCard.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 14. File Tree Sidebar Component

  **What to do**:
  - Create `src/components/FileTree.svelte`:
    - Props: `files: PrFileDiff[]`, selected file callback
    - Display files in a tree structure grouped by directory
    - Each file shows: filename, status icon (added=green, removed=red, modified=yellow, renamed=blue), +additions/-deletions count
    - Click a file → emit event with filename → parent scrolls diff viewer to that file
    - Collapsible directories
    - Summary header: "N files changed, +X additions, -Y deletions"
    - Highlight currently viewed file
  - Style to match existing sidebar patterns (DetailPanel width area)

  **Must NOT do**:
  - Do NOT implement checkbox/filter features
  - Do NOT add search within file tree
  - Do NOT show file content — just the tree

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Tree UI component with directory nesting, status colors, interactive selection
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Tree layout, directory collapsing, status color coding

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 13, 15-18)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 8, 12

  **References**:

  **Pattern References**:
  - `src/components/DetailPanel.svelte` — Sidebar component pattern (fixed width, scrollable content)

  **API/Type References**:
  - `src/lib/types.ts:PrFileDiff` — File data shape with filename, status, additions, deletions

  **Acceptance Criteria**:
  - [ ] Files displayed in directory tree structure
  - [ ] Status icons/colors per file (added/removed/modified/renamed)
  - [ ] +/- counts per file
  - [ ] Click selects file and emits event
  - [ ] Summary header with totals

  **QA Scenarios**:

  ```
  Scenario: File tree renders with correct structure
    Tool: Playwright (playwright skill)
    Preconditions: PR selected with file diffs loaded
    Steps:
      1. Open a PR in the review view
      2. Wait for `.file-tree` selector
      3. Assert: file items match number of changed files
      4. Assert: at least one file has `.status-modified` or similar status class
      5. Click a file entry
      6. Assert: clicked file has `.selected` or active styling
      7. Screenshot
    Expected Result: File tree with status indicators, clickable entries
    Evidence: .sisyphus/evidence/task-14-file-tree.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add file tree sidebar for PR diff navigation`
  - Files: `src/components/FileTree.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 15. Diff Viewer Wrapper with @git-diff-view + Lazy File Content Loading

  **What to do**:
  - Create `src/components/DiffViewer.svelte`:
    - Wraps `@git-diff-view/svelte`'s `DiffView` component
    - Props: `files: PrFileDiff[]`, `owner: string`, `repo: string`, `baseRef: string`
    - Render one diff section per file (collapsible)
    - Import and apply `@git-diff-view/svelte/styles/diff-view.css`
    - Unified/split toggle button (binds to `DiffModeEnum.Split` / `DiffModeEnum.Unified`)
    - **Two-tier rendering strategy**:
      1. Initial render: Use patch/hunk data from `PrFileDiff.patch` (no syntax highlighting)
      2. When file is expanded/visible: lazy-fetch full content via `getFileContent(owner, repo, sha)` + `getFileAtRef(owner, repo, path, baseRef)`, then re-render with full `DiffFile` (syntax highlighted)
    - Cache fetched content in a `Map<string, string>` (runtime only, not persisted)
    - Handle binary files: show "Binary file changed" placeholder instead of diff
    - Handle large files: show "Large file — click to expand" for files with 1000+ changes
    - Dark theme: set `diffViewTheme` to match Tokyo Night palette
    - Expose `scrollToFile(filename)` method for FileTree integration

  **Must NOT do**:
  - Do NOT pre-fetch all file contents on PR open (lazy only)
  - Do NOT implement comment overlay here (that's Task 16)
  - Do NOT build custom syntax highlighting (use @git-diff-view's built-in shiki)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration with third-party library, two-tier rendering, async content loading, scroll management
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Integration of @git-diff-view component, theme customization, responsive layout

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 13, 14, 17, 18)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 16, 20, 22
  - **Blocked By**: Tasks 1, 2, 5, 8, 9, 12

  **References**:

  **Pattern References**:
  - `src/components/DetailPanel.svelte` — Scrollable content area pattern

  **API/Type References**:
  - `src/lib/types.ts:PrFileDiff` — File data with patch, sha, filename
  - `src/lib/ipc.ts:getFileContent()` — Fetch blob content for syntax highlighting
  - `src/lib/ipc.ts:getFileAtRef()` — Fetch old file version

  **External References**:
  - `@git-diff-view/svelte` DiffView component: props are `data`, `diffViewMode`, `diffViewTheme`, `diffViewHighlight`
  - `@git-diff-view/file` DiffFile class: `new DiffFile(oldName, oldContent, newName, newContent, hunks, oldLang, newLang)`
  - Library docs: `https://github.com/MrWangJustToDo/git-diff-view`

  **WHY Each Reference Matters**:
  - `@git-diff-view` API: The DiffFile constructor needs old+new content for highlighting. Without content, pass hunks only for basic diff rendering.
  - IPC calls: The two-tier strategy requires calling getFileContent/getFileAtRef when user expands a file.

  **Acceptance Criteria**:
  - [ ] Diff renders for all modified files
  - [ ] Unified/split toggle works
  - [ ] Syntax highlighting appears after file content loads
  - [ ] Binary files show placeholder
  - [ ] Dark theme applied
  - [ ] `npm run build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Diff viewer renders PR changes
    Tool: Playwright (playwright skill)
    Preconditions: PR selected with file changes
    Steps:
      1. Open a PR in review view
      2. Wait for diff content to render (`.diff-view` or `[data-component="diff-view"]` selector, timeout: 15s)
      3. Assert: at least one diff hunk visible (green/red lines)
      4. Assert: file header shows filename
      5. Screenshot
    Expected Result: Diff rendered with colored additions/deletions
    Failure Indicators: Blank diff area, JavaScript errors, missing patches
    Evidence: .sisyphus/evidence/task-15-diff-viewer.png

  Scenario: Unified/split toggle works
    Tool: Playwright (playwright skill)
    Steps:
      1. With diff visible, find toggle button
      2. Click to switch to split view
      3. Assert: layout changes to side-by-side
      4. Click to switch back to unified
      5. Assert: layout returns to single-column
      6. Screenshot both states
    Expected Result: View mode toggles correctly
    Evidence: .sisyphus/evidence/task-15-split-toggle.png

  Scenario: Binary file shows placeholder
    Tool: Playwright (playwright skill)
    Preconditions: PR contains a binary file change (e.g., image)
    Steps:
      1. Open the PR
      2. Find the binary file section
      3. Assert: text "Binary file" is visible, no diff hunk
    Expected Result: Graceful binary file handling
    Evidence: .sisyphus/evidence/task-15-binary-file.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add diff viewer with @git-diff-view and lazy content loading`
  - Files: `src/components/DiffViewer.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 16. Click-to-Comment Overlay + Comment Form

  **What to do**:
  - Extend `DiffViewer.svelte` (or create `src/components/CommentOverlay.svelte`):
    - On hovering a diff line, show a subtle "+" icon/button on the gutter
    - Clicking "+" opens an inline comment form below that line
    - Comment form: textarea, "Add Comment" button, "Cancel" button
    - On submit: add to `$pendingManualComments` store with `{ path, line, side, body }`
    - Show existing review comments inline at their line positions (fetched from `getReviewComments`)
    - Existing comments: read-only display (author, body, timestamp)
    - Pending manual comments: shown with "Pending" badge, editable, deletable
  - Use `@git-diff-view`'s widget system if available (onAddWidgetClick callback), otherwise overlay with absolute positioning

  **Must NOT do**:
  - Do NOT post comments to GitHub here (that's the review submission flow)
  - Do NOT implement comment threading/replies
  - Do NOT show AI comments here (that's Task 20)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Interactive overlay UI, hover states, inline forms, positioned elements
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Hover interactions, inline form design, position calculations

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 15)
  - **Parallel Group**: Wave 3 (after Task 15 within wave)
  - **Blocks**: Tasks 20, 21, 22
  - **Blocked By**: Tasks 1, 10, 15

  **References**:

  **Pattern References**:
  - `src/components/DiffViewer.svelte` (from Task 15) — The component being extended

  **API/Type References**:
  - `src/lib/types.ts:ReviewSubmissionComment` — Shape for pending comments
  - `src/lib/stores.ts:pendingManualComments` — Store for user's pending comments
  - `src/lib/ipc.ts:getReviewComments()` — Fetch existing review comments

  **External References**:
  - `@git-diff-view` widget system: The library may expose `onAddWidget` or `extendData` props for adding interactive elements to diff lines

  **Acceptance Criteria**:
  - [ ] "+" button appears on line hover
  - [ ] Click opens inline comment form
  - [ ] Submitted comment appears as "Pending" in the diff
  - [ ] Existing review comments displayed at correct line positions
  - [ ] Pending comments are editable and deletable

  **QA Scenarios**:

  ```
  Scenario: Add a manual comment on a diff line
    Tool: Playwright (playwright skill)
    Preconditions: Diff viewer rendering a PR
    Steps:
      1. Hover over a changed line in the diff
      2. Assert: "+" button or comment icon appears
      3. Click the "+" button
      4. Assert: inline comment form appears below the line
      5. Type "This needs refactoring" in the textarea
      6. Click "Add Comment" button
      7. Assert: form closes, "Pending" comment badge appears at that line
      8. Screenshot
    Expected Result: Comment added and displayed as pending
    Failure Indicators: No "+" button on hover, form doesn't appear, comment not saved
    Evidence: .sisyphus/evidence/task-16-add-comment.png

  Scenario: Cancel comment form without saving
    Tool: Playwright (playwright skill)
    Steps:
      1. Open comment form on a line
      2. Type some text
      3. Click "Cancel"
      4. Assert: form closes, no pending comment at that line
    Expected Result: Clean cancellation, no orphaned data
    Evidence: .sisyphus/evidence/task-16-cancel-comment.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add click-to-comment overlay on diff viewer lines`
  - Files: `src/components/DiffViewer.svelte` or `src/components/CommentOverlay.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 17. Review Submission Panel (Approve / Request Changes / Comment)

  **What to do**:
  - Create `src/components/ReviewSubmitPanel.svelte`:
    - Shows at the bottom or as a floating panel when PR detail is open
    - Summary textarea: user writes overall review body
    - Pending comment count: "N comments will be submitted"
    - Three submit buttons: "Approve", "Request Changes", "Comment"
    - Each button triggers `submitPrReview()` IPC call with appropriate event type
    - After successful submission: clear `$pendingManualComments`, `$aiReviewComments` (accepted ones), show success toast
    - Error handling: show error message if submission fails (e.g., invalid line references)
    - Disable submit if no summary AND no comments

  **Must NOT do**:
  - Do NOT implement review drafts (save for later)
  - Do NOT show review history

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form panel with multiple submit actions, state management, success/error feedback
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Panel layout, button styling (green approve, red request changes, blue comment), feedback states

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 13-16, 18)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 21, 22
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/components/CheckpointPanel.svelte` — Approve/reject pattern with feedback (similar UX: action buttons with different outcomes)

  **API/Type References**:
  - `src/lib/types.ts:ReviewSubmission` — Submission data shape
  - `src/lib/ipc.ts:submitPrReview()` — IPC call for submission
  - `src/lib/stores.ts:pendingManualComments` — Comments to include
  - `src/lib/stores.ts:aiReviewComments` — AI comments (accepted ones) to include

  **Acceptance Criteria**:
  - [ ] Three distinct submit buttons (Approve, Request Changes, Comment)
  - [ ] Summary textarea for review body
  - [ ] Comment count displayed
  - [ ] Successful submission clears pending state
  - [ ] Error shown on failure

  **QA Scenarios**:

  ```
  Scenario: Submit a review with comments
    Tool: Playwright (playwright skill)
    Preconditions: PR open, at least 1 pending comment added
    Steps:
      1. Find `.review-submit-panel` or review submission area
      2. Assert: comment count shows "1 comment"
      3. Type "Looks good with minor changes" in summary textarea
      4. Click "Comment" button (safest — doesn't approve/reject)
      5. Assert: success feedback (toast or inline message)
      6. Assert: pending comments cleared
      7. Screenshot
    Expected Result: Review submitted, UI reset
    Evidence: .sisyphus/evidence/task-17-submit-review.png

  Scenario: Cannot submit empty review
    Tool: Playwright (playwright skill)
    Steps:
      1. Open review panel with no pending comments
      2. Leave summary empty
      3. Assert: submit buttons are disabled or show validation error
    Expected Result: Empty submission prevented
    Evidence: .sisyphus/evidence/task-17-empty-validation.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add review submission panel with approve/request changes/comment`
  - Files: `src/components/ReviewSubmitPanel.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 18. PR Notification Badge + Polling Extension

  **What to do**:
  - Extend `github_poller.rs` to also poll for review-requested PRs:
    - On each poll cycle (or a separate slower cycle, e.g., every 2-3 minutes), call `search_review_requested_prs()`
    - Compare with stored review_prs — detect NEW review requests
    - Emit `new-review-request` Tauri event when new PRs found
    - Store/update review_prs in DB
  - In `App.svelte`:
    - Listen for `new-review-request` event
    - Update `$reviewRequestCount` store
    - On the "PR Review" tab button, show a badge with the count (e.g., red circle with number)
    - Clear badge when user navigates to PR Review view
  - Add config: `review_poll_interval` (default: 120 seconds, separate from the faster PR comment polling)

  **Must NOT do**:
  - Do NOT send desktop/OS notifications (in-app badge only)
  - Do NOT make the poll interval user-configurable in the UI yet (hardcode with config key)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Extend existing poller pattern, add event + badge. Straightforward.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 13-17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 1, 12

  **References**:

  **Pattern References**:
  - `src-tauri/src/github_poller.rs` — Existing polling loop pattern. Add review PR polling alongside or as a separate interval.
  - `src/App.svelte` — Event listener pattern (`listen('new-pr-comment', ...)`)

  **Acceptance Criteria**:
  - [ ] New review requests detected during polling
  - [ ] `new-review-request` event emitted
  - [ ] Badge shows count on PR Review tab
  - [ ] Badge clears on view navigation

  **QA Scenarios**:

  ```
  Scenario: Badge appears when new review request detected
    Tool: Playwright (playwright skill)
    Preconditions: App running, polling active
    Steps:
      1. Navigate to Board view
      2. Wait for a poll cycle to complete (or trigger manually)
      3. Assert: PR Review tab shows badge with number if review requests exist
      4. Click PR Review tab
      5. Assert: badge clears or shows "0"
      6. Screenshot
    Expected Result: Badge visible on tab, clears on navigation
    Evidence: .sisyphus/evidence/task-18-notification-badge.png
  ```

  **Commit**: YES
  - Message: `feat(poll): add review PR polling and notification badge`
  - Files: `src-tauri/src/github_poller.rs`, `src/App.svelte`
  - Pre-commit: `cargo build && npm run build`

---

- [ ] 19. AI Review Orchestrator Flow

  **What to do**:
  - Extend `src-tauri/src/orchestrator.rs` with a new flow for AI code review:
    - New method: `start_ai_review(pr_number, owner, repo, db, opencode_client)` → `Result<String, String>` (session_id)
    - Flow:
      1. Fetch PR file diffs via `get_pr_files()`
      2. Fetch full file content for each changed file (old + new versions)
      3. Build a structured prompt with:
         - PR title, body/description
         - For each file: filename, status, the unified diff patch
         - Instructions: "Review this PR. Produce a summary and inline comments. Format each comment as: `FILE: path/to/file LINE: N SIDE: RIGHT COMMENT: your comment text`"
      4. Create OpenCode session via `opencode_client.create_session()`
      5. Send the review prompt
      6. Parse the response to extract structured comments (path, line, side, body) + summary
      7. Store parsed AI comments in memory (or a new `ai_review_results` table)
      8. Emit `ai-review-complete` event with session_id and parsed comments
    - Create agent session in DB (stage: "ai_review", status: "running" → "completed")
  - Add Tauri command: `start_ai_review(owner, repo, pr_number)` → `Result<String, String>`
  - Add Tauri command: `get_ai_review_result(session_id)` → `Result<AiReviewResult, String>`
  - Add IPC wrappers: `startAiReview()`, `getAiReviewResult()`

  **Must NOT do**:
  - Do NOT make the prompt configurable (hardcode it, iterate later)
  - Do NOT implement streaming (wait for complete response)
  - Do NOT use checkpoints/approval flow for AI review (it's one-shot: send diff → get comments)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Orchestrator extension with prompt engineering, response parsing, event emission, multiple IPC boundaries
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 20, 21)
  - **Parallel Group**: Wave 4 (start of wave)
  - **Blocks**: Task 20
  - **Blocked By**: Tasks 2, 3, 8, 9, 12

  **References**:

  **Pattern References**:
  - `src-tauri/src/orchestrator.rs:start_implementation()` — Existing orchestrator flow: create session → build prompt → send to OpenCode → parse response → emit event
  - `src-tauri/src/opencode_client.rs:create_session()` + `send_prompt()` — OpenCode API client methods
  - `src-tauri/src/orchestrator.rs` — The `address_pr_comments` flow is closest to what AI review will look like (builds prompt from PR data)

  **API/Type References**:
  - `src/lib/types.ts:AiReviewComment` — Frontend type for parsed AI comments (id, path, line, side, body, status)

  **WHY Each Reference Matters**:
  - `start_implementation()`: The exact session creation + prompt sending + event emission pattern to follow
  - `address_pr_comments`: Shows how PR data is formatted into agent prompts — reuse this pattern for review prompts

  **Acceptance Criteria**:
  - [ ] AI review session creates successfully
  - [ ] Prompt includes all file diffs
  - [ ] Response parsed into structured comments (path, line, side, body)
  - [ ] `ai-review-complete` event emitted with results
  - [ ] `cargo build` exits 0

  **QA Scenarios**:

  ```
  Scenario: AI review produces structured comments
    Tool: Bash
    Preconditions: OpenCode running, valid token, known PR
    Steps:
      1. Run: cargo test test_ai_review_flow -- --nocapture (with mocked OpenCode)
      2. Assert: session created with stage "ai_review"
      3. Assert: parsed comments have path, line, side, body fields
    Expected Result: Structured AI review comments extracted from agent response
    Evidence: .sisyphus/evidence/task-19-ai-review.txt

  Scenario: AI review handles empty PR gracefully
    Tool: Bash
    Steps:
      1. Test with a PR that has 0 changed files
      2. Assert: returns empty comment list with summary "No changes to review"
    Expected Result: Graceful handling of edge case
    Evidence: .sisyphus/evidence/task-19-empty-pr.txt
  ```

  **Commit**: YES
  - Message: `feat(agent): add AI code review orchestrator flow via OpenCode`
  - Files: `src-tauri/src/orchestrator.rs`, `src-tauri/src/main.rs`, `src/lib/ipc.ts`
  - Pre-commit: `cargo build && npm run build`

---

- [ ] 20. AI Comment Display in Diff Viewer (Accept/Reject/Edit Inline)

  **What to do**:
  - Extend the diff viewer to display AI-generated review comments inline:
    - Listen for `ai-review-complete` event in PrReviewView
    - Populate `$aiReviewComments` store with parsed comments (status: 'pending')
    - In the diff viewer, render AI comments at their line positions:
      - Distinct visual style from manual/existing comments (e.g., blue/purple background, "AI" badge)
      - Each AI comment has: Accept button, Reject button, Edit button
      - **Accept**: Changes status to 'accepted', comment moves to submission queue
      - **Reject**: Changes status to 'rejected', comment visually grays out / collapses
      - **Edit**: Opens inline textarea with AI text pre-filled, user can modify. On save → status becomes 'edited', `body` updated
    - "Accept All" / "Reject All" bulk actions at the top
    - Summary section: show AI's overall review summary at the top of the diff area
    - Count display: "N accepted, M rejected, K pending" 
  - A "Review with AI" button in the PR detail header triggers `startAiReview()`
  - Loading state while AI is processing (spinner or progress indicator)

  **Must NOT do**:
  - Do NOT allow re-running AI review (one review per PR per session — run again = new session)
  - Do NOT implement AI comment persistence across sessions (in-memory only)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex state management (per-comment status), inline rendering in diff, event-driven data flow, bulk actions
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: AI comment visual design, accept/reject/edit interactions, loading states

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Task 19)
  - **Blocks**: Tasks 21, 22
  - **Blocked By**: Tasks 15, 16, 19

  **References**:

  **Pattern References**:
  - `src/components/CheckpointPanel.svelte` — Approve/reject UX pattern (buttons, feedback, state transitions)
  - `src/components/PrCommentsPanel.svelte` — Comment display + batch action pattern

  **API/Type References**:
  - `src/lib/types.ts:AiReviewComment` — Comment shape with `status` field ('pending' | 'accepted' | 'rejected' | 'edited')
  - `src/lib/stores.ts:aiReviewComments` — Store for AI comments
  - `src/lib/ipc.ts:startAiReview()` — Trigger AI review
  - `src/lib/ipc.ts:getAiReviewResult()` — Fetch AI review results

  **Acceptance Criteria**:
  - [ ] AI comments render inline at correct line positions in diff
  - [ ] Accept/reject/edit buttons work per comment
  - [ ] "Accept All" / "Reject All" bulk actions work
  - [ ] Accepted comments counted for review submission
  - [ ] AI badge distinguishes AI comments from manual ones
  - [ ] Loading state shown while AI processes

  **QA Scenarios**:

  ```
  Scenario: AI review comments appear inline after review completes
    Tool: Playwright (playwright skill)
    Preconditions: PR open in diff viewer
    Steps:
      1. Click "Review with AI" button
      2. Wait for loading indicator to appear, then disappear (timeout: 60s for AI processing)
      3. Assert: at least 1 `.ai-comment` or `[data-comment-type="ai"]` element appears in diff
      4. Assert: AI comments have "AI" badge
      5. Assert: Accept and Reject buttons visible on each AI comment
      6. Screenshot
    Expected Result: AI comments rendered inline with action buttons
    Evidence: .sisyphus/evidence/task-20-ai-comments.png

  Scenario: Accept and reject AI comments
    Tool: Playwright (playwright skill)
    Steps:
      1. With AI comments visible, click "Accept" on first comment
      2. Assert: comment shows "Accepted" state (green indicator)
      3. Click "Reject" on second comment
      4. Assert: comment shows "Rejected" state (grayed out)
      5. Assert: accepted count updates
      6. Screenshot
    Expected Result: Per-comment accept/reject working with visual feedback
    Evidence: .sisyphus/evidence/task-20-accept-reject.png

  Scenario: Edit an AI comment before accepting
    Tool: Playwright (playwright skill)
    Steps:
      1. Click "Edit" on an AI comment
      2. Assert: textarea appears with AI text pre-filled
      3. Modify the text
      4. Click "Save" or "Accept"
      5. Assert: comment shows updated text with "Edited" indicator
    Expected Result: AI comment text editable before submission
    Evidence: .sisyphus/evidence/task-20-edit-comment.png
  ```

  **Commit**: YES
  - Message: `feat(ui): display AI review comments inline with accept/reject/edit controls`
  - Files: `src/components/DiffViewer.svelte`, `src/components/AiCommentWidget.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 21. Review Assembly — Collect Accepted AI + Manual Comments → Submit

  **What to do**:
  - Wire together the review submission flow:
    - `ReviewSubmitPanel` collects:
      1. Accepted AI comments from `$aiReviewComments` (where status === 'accepted' or 'edited')
      2. Manual comments from `$pendingManualComments`
    - Merge into single `comments[]` array for `submitPrReview()` IPC call
    - Include the review summary body and selected event (APPROVE / REQUEST_CHANGES / COMMENT)
    - Include `commit_id` (head SHA of the PR) in the submission
    - On success: clear both stores, show success toast, optionally refresh comments
    - On error: show descriptive error, preserve comments (don't clear on failure)
  - Handle edge case: AI comment line references may be stale if PR has been updated since review

  **Must NOT do**:
  - Do NOT implement partial submission (all or nothing)
  - Do NOT implement undo after submission

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Data assembly from multiple sources, error handling, state cleanup
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Tasks 16, 17, 20)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 11, 16, 17, 20

  **References**:

  **Pattern References**:
  - `src/components/CheckpointPanel.svelte` — Action → IPC call → success/error → state update pattern

  **API/Type References**:
  - `src/lib/types.ts:ReviewSubmission`, `ReviewSubmissionComment`
  - `src/lib/stores.ts:aiReviewComments`, `pendingManualComments`
  - `src/lib/ipc.ts:submitPrReview()`

  **Acceptance Criteria**:
  - [ ] AI + manual comments merged correctly
  - [ ] Review submitted with correct event type and commit_id
  - [ ] Stores cleared on success
  - [ ] Error preserves comments (no data loss)

  **QA Scenarios**:

  ```
  Scenario: Submit review with both AI and manual comments
    Tool: Playwright (playwright skill)
    Preconditions: PR open, AI review done (2 accepted comments), 1 manual comment added
    Steps:
      1. Assert: review panel shows "3 comments will be submitted"
      2. Type review summary
      3. Click "Comment" submit button
      4. Assert: success feedback
      5. Assert: all pending comments cleared
      6. Screenshot
    Expected Result: Mixed comment sources submitted as single review
    Evidence: .sisyphus/evidence/task-21-mixed-submit.png

  Scenario: Failed submission preserves comments
    Tool: Playwright (playwright skill)
    Preconditions: Comments pending, simulate error (e.g., invalid line)
    Steps:
      1. Trigger submission with a stale line reference
      2. Assert: error message displayed
      3. Assert: comments are still in the stores (not cleared)
    Expected Result: No data loss on failed submission
    Evidence: .sisyphus/evidence/task-21-error-preserve.png
  ```

  **Commit**: YES
  - Message: `feat(review): wire review assembly from AI + manual comments to GitHub submission`
  - Files: `src/components/ReviewSubmitPanel.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 22. PR Detail View — Assemble All Sub-Components

  **What to do**:
  - Complete `src/components/PrReviewView.svelte`:
    - When `$selectedReviewPr` is set, show the PR detail area:
      - **Header**: PR title, number, author, repo, created date, draft badge, "Review with AI" button
      - **Left sidebar**: FileTree component (from Task 14)
      - **Main content**: DiffViewer with comment overlay (from Tasks 15, 16, 20)
      - **Bottom/floating**: ReviewSubmitPanel (from Task 17)
    - Wire FileTree click → DiffViewer `scrollToFile()`
    - Wire "Review with AI" button → `startAiReview()` → listen for `ai-review-complete` → populate AI comments
    - Wire review submission → clear + refresh
    - Add "Back to PR list" button or breadcrumb
    - Handle loading states: fetching files, fetching content, AI review in progress
    - Listen for Tauri events: `ai-review-complete`
  - Layout: file tree (250px left), diff viewer (flex 1 center), review panel (bottom bar)

  **Must NOT do**:
  - Do NOT add features not built in previous tasks
  - Do NOT implement PR metadata editing

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Assembly of 5+ components into cohesive layout with interconnected data flow
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Layout composition, responsive sizing, visual cohesion

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final task)
  - **Blocks**: Task 25
  - **Blocked By**: Tasks 13-18, 20, 21

  **References**:

  **Pattern References**:
  - `src/App.svelte` — How KanbanBoard + DetailPanel compose the main view
  - `src/components/DetailPanel.svelte` — Multi-tab layout with conditional content

  **API/Type References**:
  - All stores: `selectedReviewPr`, `prFileDiffs`, `aiReviewComments`, `pendingManualComments`
  - All IPC: `getPrFileDiffs`, `startAiReview`, `getAiReviewResult`, `submitPrReview`

  **Acceptance Criteria**:
  - [ ] All sub-components integrated and wired
  - [ ] File tree click scrolls to file in diff viewer
  - [ ] AI review trigger → results → display flow works end-to-end
  - [ ] Review submission flow works end-to-end
  - [ ] Back navigation to PR list works
  - [ ] `npm run build` exits 0

  **QA Scenarios**:

  ```
  Scenario: Full PR review workflow end-to-end
    Tool: Playwright (playwright skill)
    Preconditions: App running, GitHub token configured, user has review requests, OpenCode running
    Steps:
      1. Navigate to PR Review view
      2. Click on a PR card
      3. Assert: file tree, diff viewer, and review panel all render
      4. Click a file in file tree → assert diff viewer scrolls to it
      5. Click "Review with AI" → wait for completion
      6. Assert: AI comments appear inline
      7. Accept 1 AI comment, reject another
      8. Add a manual comment on a diff line
      9. Type review summary
      10. Click "Comment" button
      11. Assert: success feedback
      12. Screenshot each major step
    Expected Result: Complete review workflow from PR selection to submission
    Failure Indicators: Any step failing — component not rendering, event not firing, submission error
    Evidence: .sisyphus/evidence/task-22-full-workflow.png
  ```

  **Commit**: YES
  - Message: `feat(ui): assemble PR detail view with file tree, diff viewer, and review panel`
  - Files: `src/components/PrReviewView.svelte`
  - Pre-commit: `npm run build`

---

- [ ] 23. Frontend Tests (Vitest) for New Components

  **What to do**:
  - Write vitest tests for:
    - `ReviewPrCard.test.ts` — renders PR data correctly, click handler, draft badge, +/- counts
    - `FileTree.test.ts` — renders files, directory grouping, click event, status icons
    - `ReviewSubmitPanel.test.ts` — button states, comment count, submission trigger
    - `PrReviewView.test.ts` — view switching, PR selection, component rendering
  - Follow existing test patterns (colocated .test.ts files, @testing-library/svelte, vi.mock for IPC)
  - Mock all IPC calls with `vi.mock('../lib/ipc', ...)`
  - Use typed fixtures for test data

  **Must NOT do**:
  - Do NOT test @git-diff-view internals (third-party library)
  - Do NOT write integration tests (that's Task 25)
  - Do NOT test Rust backend (that's Task 24)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test files with mocking, fixtures, assertions across components
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 24)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task F2
  - **Blocked By**: Tasks 13-22

  **References**:

  **Test References**:
  - `src/components/TicketCard.test.ts` — Existing component test pattern: render, screen queries, fixture objects
  - `src/components/Toast.test.ts` — Another test pattern reference
  - `src/__mocks__/@tauri-apps/api/` — Mock directory for Tauri APIs

  **Acceptance Criteria**:
  - [ ] `npx vitest run` — all new tests pass
  - [ ] Each test file covers: render, user interactions, edge cases (empty state)
  - [ ] All IPC calls properly mocked

  **QA Scenarios**:

  ```
  Scenario: All frontend tests pass
    Tool: Bash
    Steps:
      1. Run: npx vitest run --reporter=verbose
      2. Assert: exit code 0
      3. Assert: new test files appear in output (ReviewPrCard, FileTree, etc.)
    Expected Result: All tests pass with no failures
    Evidence: .sisyphus/evidence/task-23-frontend-tests.txt
  ```

  **Commit**: YES
  - Message: `test(frontend): add vitest tests for PR review components`
  - Files: `src/components/ReviewPrCard.test.ts`, `src/components/FileTree.test.ts`, `src/components/ReviewSubmitPanel.test.ts`, `src/components/PrReviewView.test.ts`
  - Pre-commit: `npx vitest run`

---

- [ ] 24. Rust Tests (cargo test) for New API Methods + DB

  **What to do**:
  - Write tests in `github_client.rs` for:
    - `get_authenticated_user` — mock HTTP response, verify login extraction
    - `search_review_requested_prs` — mock search response, verify parsing
    - `get_pr_files` — mock response, verify file diff parsing
    - `get_blob_content` — mock Base64 response, verify decoding
    - `submit_review` — mock POST, verify request body formatting
  - Write tests in `db.rs` for:
    - `test_review_pr_operations` — insert, query, delete review PRs
    - `test_review_pr_comment_operations` — insert, query comments with position data
  - Follow existing test patterns: `#[cfg(test)] mod tests`, temp DB creation, cleanup

  **Must NOT do**:
  - Do NOT test against live GitHub API (mock all HTTP)
  - Do NOT modify existing tests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test modules with HTTP mocking and DB test helpers
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 23)
  - **Parallel Group**: Wave 5
  - **Blocks**: Task F2
  - **Blocked By**: Tasks 3, 6-12

  **References**:

  **Test References**:
  - `src-tauri/src/db.rs:mod tests` — Existing DB test pattern with `make_test_db`, temp file cleanup
  - `src-tauri/src/github_client.rs` — Check for existing tests or follow db.rs pattern

  **Acceptance Criteria**:
  - [ ] `cargo test` — all new tests pass
  - [ ] HTTP responses properly mocked
  - [ ] DB operations tested end-to-end with temp database

  **QA Scenarios**:

  ```
  Scenario: All Rust tests pass
    Tool: Bash
    Steps:
      1. Run: cargo test -- --nocapture 2>&1
      2. Assert: exit code 0
      3. Assert: new test names appear in output
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-24-rust-tests.txt
  ```

  **Commit**: YES
  - Message: `test(backend): add Rust tests for PR review API methods and DB operations`
  - Files: `src-tauri/src/github_client.rs`, `src-tauri/src/db.rs`
  - Pre-commit: `cargo test`

---

- [ ] 25. End-to-End Integration Test

  **What to do**:
  - Create a Playwright test that exercises the full PR review workflow:
    1. App launches and PR Review tab is accessible
    2. Switch to PR Review view
    3. PR list loads with at least 1 PR
    4. Click a PR → detail view opens with file tree + diff
    5. Verify diff content renders (colored lines)
    6. Add a manual comment on a diff line
    7. Verify comment appears as pending
    8. Open review submit panel
    9. Verify comment count is correct
  - Note: AI review and actual GitHub submission are hard to test E2E — focus on UI flow
  - This test validates the full integration of all components

  **Must NOT do**:
  - Do NOT submit actual reviews to GitHub in tests
  - Do NOT test AI review in E2E (too slow and depends on OpenCode)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex Playwright test with multi-step interaction, many assertions, screenshot evidence
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for E2E testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (after Tasks 23, 24)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 22

  **References**:

  **Pattern References**:
  - Any existing Playwright test files in the project (check `tests/` or `e2e/` directory)

  **Acceptance Criteria**:
  - [ ] Playwright test passes end-to-end
  - [ ] Screenshots captured at each major step
  - [ ] No console errors during test run

  **QA Scenarios**:

  ```
  Scenario: Full E2E PR review flow
    Tool: Playwright (playwright skill)
    Preconditions: App running, GitHub token configured
    Steps:
      1. Navigate to http://localhost:1420
      2. Click "PR Review" tab
      3. Wait for PR list to load
      4. Click first PR card
      5. Assert: file tree renders with files
      6. Assert: diff viewer renders with colored diff content
      7. Hover over a changed line, click "+" to add comment
      8. Type comment, submit
      9. Assert: pending comment appears
      10. Assert: review panel shows "1 comment"
      11. Screenshot all states
    Expected Result: Complete UI workflow works without errors
    Evidence: .sisyphus/evidence/task-25-e2e-flow.png
  ```

  **Commit**: YES
  - Message: `test(e2e): add Playwright end-to-end test for PR review workflow`
  - Files: test file location TBD
  - Pre-commit: `npm run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx svelte-check` + `cargo clippy` + `npm run test` + `cargo test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: upgrade Svelte from v4 to v5` | package.json, lock, configs | `npm run build && npm run test` |
| 2 | `feat(types): add TypeScript types and stores for PR review feature` | types.ts, stores.ts | `npm run build` |
| 3 | `feat(db): add Rust structs and DB schema for PR review data` | github_client.rs, db.rs | `cargo build && cargo test` |
| 4 | `feat(nav): add top-bar view switcher for Board, PR Review, Settings` | App.svelte, PrReviewView.svelte | `npm run build` |
| 5 | `chore(deps): install @git-diff-view/svelte for diff rendering` | package.json, lock | `npm run build` |
| 6 | `feat(github): auto-detect GitHub username from PAT` | github_client.rs, db.rs, main.rs | `cargo build` |
| 7 | `feat(github): search for PRs requesting user review across all repos` | github_client.rs | `cargo build` |
| 8+9 | `feat(github): add PR file diff and blob content fetching` | github_client.rs | `cargo build` |
| 10 | `feat(github): fetch positioned review comments for PRs` | github_client.rs | `cargo build` |
| 11 | `feat(github): submit PR reviews with batched inline comments` | github_client.rs | `cargo build` |
| 12 | `feat(ipc): add Tauri commands and IPC wrappers for PR review` | main.rs, ipc.ts | `cargo build && npm run build` |
| 13 | `feat(ui): add PR list view with grouped review-requested PRs` | PrReviewView.svelte, ReviewPrCard.svelte | `npm run build` |
| 14 | `feat(ui): add file tree sidebar for PR diff navigation` | FileTree.svelte | `npm run build` |
| 15 | `feat(ui): add diff viewer with @git-diff-view and lazy content loading` | DiffViewer.svelte | `npm run build` |
| 16 | `feat(ui): add click-to-comment overlay on diff viewer lines` | DiffViewer.svelte, CommentOverlay.svelte | `npm run build` |
| 17 | `feat(ui): add review submission panel with approve/request changes/comment` | ReviewSubmitPanel.svelte | `npm run build` |
| 18 | `feat(poll): add review PR polling and notification badge` | github_poller.rs, App.svelte | `cargo build && npm run build` |
| 19 | `feat(agent): add AI code review orchestrator flow via OpenCode` | orchestrator.rs, main.rs, ipc.ts | `cargo build && npm run build` |
| 20 | `feat(ui): display AI review comments inline with accept/reject/edit controls` | DiffViewer.svelte, AiCommentWidget.svelte | `npm run build` |
| 21 | `feat(review): wire review assembly from AI + manual comments to GitHub submission` | ReviewSubmitPanel.svelte | `npm run build` |
| 22 | `feat(ui): assemble PR detail view with file tree, diff viewer, and review panel` | PrReviewView.svelte | `npm run build` |
| 23 | `test(frontend): add vitest tests for PR review components` | *.test.ts files | `npx vitest run` |
| 24 | `test(backend): add Rust tests for PR review API methods and DB operations` | github_client.rs, db.rs | `cargo test` |
| 25 | `test(e2e): add Playwright end-to-end test for PR review workflow` | test file | `npm run build` |

---

## Success Criteria

### Verification Commands
```bash
npm run build          # Expected: exit 0, no errors
npm run test           # Expected: all tests pass
cargo build            # Expected: exit 0, no errors
cargo test             # Expected: all tests pass
npm run dev            # Expected: app starts on :1420
```

### Final Checklist
- [ ] All "Must Have" items present and functional
- [ ] All "Must NOT Have" items absent from codebase
- [ ] All tests pass (vitest + cargo test)
- [ ] App builds without errors (npm + cargo)
- [ ] PR Review view accessible from top bar
- [ ] PRs load from multiple repos
- [ ] Diff viewer renders with syntax highlighting
- [ ] AI review produces and displays inline comments
- [ ] Manual comments can be added on diff lines
- [ ] Review submission works (Approve / Request Changes / Comment)
- [ ] Notification badge shows new review request count

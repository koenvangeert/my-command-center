## 1. Shared right-hand panel

- [x] 1.1 Add a failing public workspace test for one right-hand panel, Changed files selected initially, and the unchanged project sidebar; replace the two independently resizable columns with the shared application-owned panel and verify that test passes.
- [x] 1.2 Replace independent panel-visibility state with shared disclosure and tab selection in the existing navigation owner; verify tab switching, collapse/reopen restoration, and open/files initialization for a new task through integration tests.
- [x] 1.3 Adapt the existing changed-files and GitHub content components and their standalone story frames to the single resize owner; verify the tree, Scope controls, commit history, comment controls, and existing component stories still render and work without nested resize boundaries.

## 2. State and keyboard navigation

- [x] 2.1 Add tab-switch regressions for changed-file filters and scroll, commit/review scope, reviewed-file state, selected GitHub comments, pending inline comments, and diff position; implement the required state retention and verify the regressions pass without remounting the diff.
- [x] 2.2 Add empty/unlinked and populated GitHub scenarios, including comments arriving or disappearing during review; verify files remains the initial tab, an explicitly opened empty comments tab is usable, and refreshes do not override disclosure or tab selection.
- [x] 2.3 Connect the existing diff file-navigation toggle and focus actions to the shared panel; verify a request opens Changed files from the comments tab or collapsed state and focuses the tree, with keyboard tab semantics and no hidden-content focus targets.
- [x] 2.4 Verify task switching and review teardown isolate feedback and presentation state; retain existing task-scoped draft/scroll behavior and confirm tab visibility does not leave unnecessary measurement or focus work active.

## 3. Review-bar feedback submission

- [x] 3.1 Add a failing test for Send feedback with the shared panel collapsed; move the single send action and prompt-dialog owner to the workspace review bar and verify the action remains present in both tabs and loading, empty, and failed diff states.
- [x] 3.2 Verify the send count and eligibility through inline-only, selected-GitHub-only, mixed-feedback, empty-feedback, running-agent, and paused-agent cases; preserve existing comment selection semantics and provide accessible disabled explanations.
- [x] 3.3 Exercise cancel and confirmed submission with the panel collapsed; replace unconditional feedback clearing with snapshot reconciliation and verify feedback added or edited after preview capture and newly selected GitHub comments survive, along with success behavior, focus return, and tab/disclosure state.
- [x] 3.4 Keep refresh reachable from the review bar and remove obsolete feedback-column toggle/jump controls without duplicating diff-mode state; verify refresh and existing Split, Unified, Wrap, and search interactions remain available.

## 4. Bounded layout and public browser checks

- [x] 4.1 Remove workspace-level horizontal scrolling, mount-time positioning, jump navigation, and the 540px diff floor; replace the old browser expectations and verify the file tree and diff are visible together before any click at 900, 1280, 1600, and 1920px with the default sidebar open.
- [x] 4.2 Implement one preferred panel width with host-bounded effective sizing and a new storage key; verify pointer/keyboard resizing, oversized saved widths, wide-to-narrow-to-wide host resizing, and unchanged project-sidebar geometry. If an SDK sizing extension is needed, add its contract tests and run its subsystem checks without bundling KVG-4893.
- [x] 4.3 Check review-bar actions, tabs, disclosure, and panel controls against clipping ancestors before browser interaction; verify readable pending comments in Unified mode at 900px, operable Split controls/code-local scrolling, and no horizontal workspace scrolling to access controls.
- [x] 4.4 Extend page stories and browser interactions for populated GitHub comments, inline-only feedback, tab selection, panel collapse/reopen, and keyboard send-preview cancellation; verify the new scenarios use the production task workspace rather than a simplified layout fixture.

## 5. Validation and completion

- [x] 5.1 Update only the affected UI geometry inventory entries and browser-check documentation; verify `pnpm lint`, `pnpm exec tsc --noEmit`, and the inventory tests pass with specific layout justifications rather than broad exceptions.
- [x] 5.2 Run the focused Self Review integration/controller/browser suites and full affected-system tests/static checks required by `CONTRIBUTING.md` and `AGENTS.md`; report exact results, environment-gated skips, isolated retries, and any remaining gaps for the complete implementation diff.
- [x] 5.3 Run the canonical visual check, inspect the changed review page/component captures, update only intentional affected baselines through the documented workflow, and verify a subsequent `pnpm storybook:visual:check` passes without unrelated screenshot changes.
- [x] 5.4 Run the required single fresh-context review against the recorded pre-implementation baseline, resolve or report its findings, and update KVG-4777 Handoff Notes with the actual implementation outcome and the existing KVG-4893 follow-up before committing the completed implementation.

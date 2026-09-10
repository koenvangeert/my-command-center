## Why

KVG-4777's minimum-width, horizontally scrolling layout makes the diff reachable by moving the changed-file tree almost entirely out of view. Self Review needs to keep file navigation useful without changing the project sidebar, and sending feedback must not depend on keeping a comments pane open.

## What Changes

- Replace the separate changed-files and feedback columns with one resizable, collapsible panel docked on the right at every supported width.
- Give that panel Changed files and GitHub comments tabs, showing Changed files initially. GitHub comments remain reachable even when there are none, but an empty comment list does not take space away from file navigation.
- Preserve changed-file navigation, review scope, commit history, GitHub comment selection, and existing review state while switching tabs or collapsing the panel.
- Put Send feedback in the review bar, outside the tab panels. Keep the existing prompt preview, busy-agent rules, and combined submission of pending inline comments and selected GitHub comments.
- On confirmation, remove only unchanged feedback captured in the preview. Preserve comments added or edited after preview capture, including newly selected GitHub comments.
- Remove whole-workspace horizontal scrolling, automatic scrolling to code, and the fixed 540px diff floor. Keep scrolling for code content inside the diff where needed.
- Leave the project sidebar open and unchanged. Do not introduce a bottom pane, overlay drawer, automatic project-sidebar collapse, or a narrow-only alternate layout.
- Replace reachability-after-scrolling checks with public layout and interaction checks of the production task workspace, and refresh the affected canonical screenshots.

## Capabilities

### New Capabilities

- `self-review-workspace`: Shared right-hand review navigation, bounded layout, and review-bar feedback submission independent of panel visibility.

### Modified Capabilities

None. Existing specs cover related diff content and browser annotations, but do not define Self Review panel arrangement or its send-action placement.

## Impact

- Renderer workspace and panel composition in `src/components/task-detail/SelfReviewWorkspace.svelte`, its panel components, navigation controller, and workspace controller.
- `SelfReviewDiffPanel.svelte` toolbar integration and `SendToAgentPanel.svelte` presentation/dialog ownership, while preserving their existing review and submission behavior.
- Self Review integration tests, `storybook/stories/pages/SelfReview.browser.test.ts`, page stories, affected visual baselines, and the narrowly scoped UI geometry inventory entries.
- No backend, IPC, database, or dependency changes are intended. Shared PR review package ownership and the attention architecture remain unchanged.
- KVG-4893, the independent resize-listener cleanup, remains outside this change.

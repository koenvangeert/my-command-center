## Context

See proposal.md for motivation and specs/self-review-workspace/spec.md for the behavior contract. This design is needed because the change crosses panel composition, navigation state, and feedback-dialog lifetime.

The current `SelfReviewWorkspace.svelte` renders separate changed-files and feedback panels around the diff. Each panel owns a fixed-width resizable wrapper. The latest KVG-4777 implementation adds a 540px diff floor, an overflowing workspace row, and navigation that scrolls the row to a panel. Those mechanisms are the rejected approach, not a foundation to preserve.

`selfReviewNavigationController.svelte.ts` currently has independent file-tree and feedback visibility state. The workspace controller exposes that navigation and supplies changed-files and feedback pane models. `SelfReviewFeedbackPanel.svelte` contains `SendToAgentPanel.svelte`, which owns its prompt dialog and snapshots the feedback being sent. Moving only a button would leave sending coupled to whether that panel is mounted.

At a 900px host width, the default project sidebar and icon rail leave approximately 556px for review. Two useful panes must share that width. A 540px diff minimum cannot coexist with visible file navigation there.

## Goals / Non-Goals

**Goals:**
- Give the workspace one authoritative panel selection and disclosure state.
- Keep the diff and send-preview lifetime independent of tab selection.
- Bound the shared panel against actual workspace width, including previously saved widths.
- Reuse existing review data ownership and SDK controls rather than introducing a second review model.

**Non-Goals:**
- No changes to project-sidebar state, task-header actions, attention handling, or shared PR review package ownership.
- No automatic switch between Split and Unified diff modes.
- No promise that every long code line is visible without code-local scrolling.
- No new backend contract, persistent task schema, or general-purpose docking framework.
- No KVG-4893 drag-listener cleanup bundled into this change.

## Decisions

### 1. One right-hand shell owns width, tabs, and collapse

Introduce an application-owned `SelfReviewSidePanel.svelte` to compose a single right-side resize boundary and the existing panel contents. Move the two existing resizable wrappers out of their content components; do not nest them inside the new panel or override fixed widths with descendant CSS. Update standalone panel story frames to supply the necessary surrounding layout.

Keep the changed-file tree and its Scope/commit-history section together in Changed files. GitHub comments contains comment selection, filtering, addressed controls, external links, and list states. Refresh remains available from the review bar after the old send footer moves out, so it is not lost on either tab.

Use the existing SDK tab controls and their keyboard behavior. Hidden tab content must be removed from focus navigation. Prefer retaining tab content during the mounted task session so file filtering and local scrolling survive; ensure hidden content does not keep active measurement or focus work running. Do not remount the diff to switch tabs.

Alternative rejected: keep two independently resizable panels and coordinate their visibility. That preserves conflicting visibility states and leaves the user managing two separate widths for one available slot.

### 2. Represent disclosure and selected content separately

Replace independent panel booleans with `sidePanelVisible` and `sidePanelTab`, whose values are `files` or `github-comments`. Keep the state in the existing application navigation owner, with a small public interface for selecting a tab, opening, closing, and toggling the panel. Update pane callbacks and tests at the same time; avoid retaining contradictory legacy booleans as a second authority.

Initial state for a task is open / files. Collapse retains the selected tab, and reopening restores it. A new task resets presentation to open / files while existing task-scoped review state continues to use its current owners. Panel selection is session-local; this change does not add cross-session tab persistence.

GitHub comment counts do not drive disclosure or tab changes after initialization. The earlier request to auto-collapse an empty feedback pane is satisfied by not displaying its content initially: files occupies the shared slot instead. Explicitly opening an empty GitHub comments tab remains possible.

Map the diff's file-tree toggle/focus actions to this shared model: when closed or displaying comments, a file-navigation request opens files; when files is already open, its toggle can collapse the shared panel. Focus requests select/open files, await rendering, then focus the tree. A general disclosure control in the review bar restores the last selected tab.

Alternative rejected: automatically selecting GitHub comments when comments arrive, or switching away when the last comment disappears. Background refreshes must not interrupt the user's navigation.

### 3. Put review actions above the entire diff/panel row

The review bar spans the available Self Review workspace, not the narrow diff column alone. It owns panel disclosure, Send feedback, and refresh. Diff-specific controls retain their existing behavior; do not create two independent sources of truth for Split, Unified, Wrap, or search.

Reuse or extract the presentation of `SendToAgentPanel.svelte` so one workspace-level instance owns the send action, preview draft, captured comment snapshot, reconciliation, and success message. The GitHub tab must no longer own that instance. Avoid mounting duplicate composers for different tabs or widths. Keep the send label as Send feedback in the review bar; retain the existing confirmation flow and agent submission contract.

Read pending inline comments and selected GitHub comments from their existing owners. Distinguish the number of available GitHub comments in the tab label from the number eligible to send beside the action. Preserve busy-agent and empty-feedback disabling. Loading or failure of the diff must not remove the review bar or destroy an open preview.

The owner approved fixing feedback loss during this move. Capture complete inline comment values and selected GitHub comment identities when opening the preview. On confirmation, reconcile against current feedback: remove only unchanged captured inline comments and deselect only unchanged captured GitHub comments. Retain newer or edited feedback. Pass the sent GitHub snapshot to the existing completion callback instead of clearing all selections. This replaces the old unconditional clearing behavior; cancellation still leaves feedback unchanged.

Alternative rejected: putting Send feedback into the current diff viewer's toolbar-extra area without changing its lifetime. That area is absent in loading/empty/error states and is constrained by the diff column's width.

### 4. Budget width locally instead of scrolling the workspace

Remove the horizontal scrolling row, `showPanel` scroll positioning, mount-time horizontal scroll, jump-to-Code navigation, and the hard 540px diff floor. The diff flexes beside the right-hand panel within the host; only code content can scroll horizontally.

Use one saved preferred panel width with a new Self Review side-panel key. Do not import either legacy panel width, since a saved 620px comments panel could consume a narrow host. Clamp the effective width on initial restore, pointer/keyboard resize, and host resize without overwriting a larger preferred width merely because the window temporarily shrank.

Starting geometry for implementation is a 320px preferred panel, a 240px panel minimum, and a 300px reserved diff width within the specified 900px-and-up host matrix. With about 556px available, the panel can use at most 256px and the diff retains at least 300px. At 1280px with about 936px available, the default panel leaves about 616px for the diff. Treat these as feature-layout values to verify with real controls and fonts, not assertions that every split code line fits. Below the covered host matrix, effective sizing must still stay inside the host rather than reinstating whole-workspace overflow.

The shared panel's resize behavior must accept an effective host bound. Adapt application composition first; if the SDK resizer needs a narrow sizing extension, keep it limited to controlled width/bounds and validate the SDK subsystem rather than adding review-specific policy to it. This does not authorize unrelated resize cleanup.

Keep tab labels, disclosure, and Send feedback in view with local wrapping or compact control layout. Preserve user choice of Split/Unified; use Unified explicitly in the narrow readability acceptance check, and check that Split controls and code-local scrolling remain operable.

Alternative rejected: keeping the 540px diff floor. It mathematically excludes a visible shared panel at the narrow target and repeats the first implementation's failure.

### 5. Test visibility before interaction, not reachability after scrolling

Use the production TaskDetail page host with the default AppSidebar and IconRail. Replace the existing browser regression's jump-navigation expectations with assertions that the file tree and diff are visible together before any action. Assert bounds against clipping ancestors before clicking, so browser auto-scroll cannot hide a regression.

Cover the four specified widths, both tabs, an empty/unlinked comments state, populated GitHub comments, inline-only feedback, mixed selected feedback, collapse/reopen, keyboard focus, host resizing, and an oversized stored panel width. Exercise cancellation and confirmed submission with the panel collapsed. Keep unit/integration tests for state preservation and existing pane/commit/scroll behavior.

Refresh only affected canonical page/component baselines using the documented pinned environment. Existing 540px-floor assertions and horizontal-scroll expectations must be replaced, not retained as compatibility requirements. Run affected-system tests and static checks, with SDK checks widened only if its resizer contract changes. The previous implementation's full-suite timing failures passed in isolation; report retries and gaps rather than treating that historical run as validation for this change.

## Risks / Trade-offs

- Files and GitHub comments cannot be visible simultaneously. Mitigation: stable tab placement, separate available/selected counts, and preserved review state when switching.
- A 900px host still provides a narrow diff while the panel is open. Mitigation: bounded panel width, manual panel collapse, existing Unified mode and code-local scrolling, and browser checks of actual pending-comment text.
- Moving panel contents can reset local state or expose hidden focus targets. Mitigation: retain content where safe, gate hidden measurement work, and test filter/scroll/focus preservation through public controls.
- Moving the composer can change dialog lifetime or lose comments added after preview capture. Mitigation: preserve the existing capture/reconciliation logic and extend submission regressions before changing composition.
- Saved widths can bypass a layout that works at defaults. Mitigation: test restoration and host resizing, not just default screenshots.

## Migration Plan

1. Add public behavior regressions for the new layout and independent send action.
2. Replace the application navigation and composition, keeping current review/submission owners.
3. Use a new preferred-width storage key; leave old keys ignored rather than deleting user preferences during rendering.
4. Update story fixtures, geometry-policy entries, documented browser commands, and affected canonical images after inspection.
5. Validate the complete change and run the required fresh-context review before implementation completion.

Rollback can revert the implementation and matching baselines without a database migration. Existing review data and legacy width preferences remain intact. This proposal intentionally supersedes the horizontal-scroll layout introduced by `ecef83da`; it does not erase unrelated work on KVG-4777.

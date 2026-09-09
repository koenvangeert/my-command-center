## Why

The task toolbar's polished action menu currently depends on app-local styling, so SDK consumers cannot reuse it out of the box. Making the menu design shared and publishing a split button gives the app and plugins the same accessible controls without copying toolbar CSS.

## What Changes

- Make the compact action-menu design the default for SDK `AnchoredMenu`, preserving existing props and interaction behavior.
- Export `SplitButton.svelte` from the Plugin SDK, combining an independent primary action with an attached action-menu trigger.
- Support existing button sizes and variants, explicit disabled states, accessible menu labels, and custom item content through snippets.
- Migrate the task toolbar to the SDK split button and remove its menu and joined-button styling overrides.
- Add SDK usage documentation, component stories, behavioral coverage, browser verification, and published-entrypoint checks.

## Capabilities

### New Capabilities

- `sdk-action-controls`: Shared action-menu presentation and reusable split-button behavior for host and plugin consumers.

### Modified Capabilities

None. No existing main spec defines these SDK controls.

## Impact

- `packages/plugin-sdk/src/ui/AnchoredMenu.svelte` and a new sibling `SplitButton.svelte`.
- SDK public exports, entrypoint registries, package contract checks, documentation, and UI stories.
- `src/components/task-detail/TaskDetailToolbar.svelte` and its regression coverage.
- Existing AnchoredMenu consumers receive the new default appearance, requiring visual regression checks beyond the toolbar.
- No new runtime dependency, task lifecycle change, IPC change, or plugin capability is required. The public component addition is additive; existing menu interactions remain compatible.

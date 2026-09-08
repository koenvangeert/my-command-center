## Why

OpenForge still depends on daisyUI for presentation across host views, shared packages, and bundled plugins, despite owning its semantic theme contract and SDK controls. Removing that dependency after migrating its actual consumers will eliminate the temporary compatibility adapter without breaking contributed themes or changing the workspace layout.

## What Changes

- Add OpenForge semantic color utilities with opacity and interaction-variant support, backed directly by the active `--of-*` tokens. Existing direct-token styling remains supported.
- Complete SDK feedback coverage for loading indicators, alerts, and progress, and migrate covered controls behind their existing public interfaces.
- Inventory actual class and CSS-variable consumers, then migrate SDK, review, terminal, plugin, and host code in independently validated slices.
- Preserve mounted state, keyboard behavior, accessible feedback, geometry, reduced motion, and built-in and contributed theme selection.
- Remove the daisyUI plugin, dependency, lockfile entry, and temporary color and geometry mappings only after all first-party consumers and executable fixtures have moved. Retain unrelated focus, font, and reduced-motion behavior currently located in the adapter.
- Preserve KVG-4522's completed settings migration. Limit remaining settings work to dependencies still needed for final removal, such as loading indicators.

## Capabilities

### New Capabilities

- `semantic-ui-styling`: Supported semantic color utilities and SDK feedback controls that render without daisyUI and respond to built-in and arbitrary contributed themes.

### Modified Capabilities

None. Existing theme identifiers, token schemas, selection/fallback behavior, and public SDK interfaces remain compatible. This change adds styling and feedback APIs rather than redefining Studio or Workshop designs. The pending `add-angular-extensible-theming` change remains the source for the broader theme registry and building-block contracts.

## Impact

- Host renderer under `src`, including `src/app.css` and `src/styles/theme-adapter.css`.
- `packages/plugin-sdk`, `packages/pr-review-ui`, and presentation consumers in `packages/terminal-runtime`.
- Bundled `github-sync`, `file-viewer`, `task-browser`, and `terminal` plugins, plus any additional consumers confirmed by the inventory.
- SDK export registries, generated assets, publication contract checks, migration guardrails, browser fixtures, and theme regression tests.
- Root dependency and build output. Tailwind remains; backend, IPC, database, terminal session ownership, and settings business logic are outside scope.
- Coordination: KVG-4687 follows the compatibility repair in KVG-4671 and the completed caller migration in KVG-4522. Undocumented host daisyUI classes are not a public plugin contract; plugin-owned CSS and documented SDK/theme contracts remain supported.

## Why

OpenForge offers light and dark versions of one visual style. Users want distinct styles for the same workspace: a restrained Codex-inspired option and a sharper developer-workbench option, both usable in light and dark environments.

## What Changes

- Replace OpenForge Light/Dark with the Studio Light/Dark designs, retaining the existing OpenForge names and identifiers. Add Workshop Light and Workshop Dark; do not expose separate Studio choices.
- Give Studio neutral surfaces, rounded controls and panels, near-monochrome actions, and restrained shadows, taking inspiration from the Codex app's light appearance.
- Give Workshop warm paper or graphite surfaces, amber accents, crisp borders, compact corners, and monospaced technical labels.
- Apply each style consistently to theme-aware host controls, shared plugin building blocks, code, diffs, Markdown, and terminals while preserving navigation, layout, and interaction behavior.
- Use the existing theme picker and saved theme identifier. Keep existing default identifiers, legacy preference migration, contributed themes, and fallback routing unchanged. Existing OpenForge selections automatically receive the redesigned palette.
- Extend the existing visual-review tooling to cover the four supported identifiers and representative page and component states.
- Repair the Storybook terminal replay fixtures to supply explicit parser continuation required by the existing runtime contract. The owner authorized this prerequisite repair during implementation; no terminal runtime behavior change is intended.
- Defer Glass, including in-app frosted layers. No native window transparency, theme editor, or automatic system-appearance switching is included.

## Capabilities

### New Capabilities

- `studio-workshop-themes`: Availability, visual identity, selection compatibility, content presentation, and accessibility of Studio and Workshop in light and dark variants.

### Modified Capabilities

None. The general `application-theming` capability currently exists in the unarchived `add-angular-extensible-theming` change, not in `openspec/specs/`. This change adds a focused capability on top of its implemented registry and token contract without rewriting that change's artifacts.

## Impact

- Renderer built-in theme definitions and registration under `src/lib/themeContract.ts` and theme modules; existing settings and theme adapters remain the integration points.
- Theme-aware host and SDK building blocks only where needed to express the two styles through existing semantic tokens. No new public SDK token requirement is planned.
- Theme selection, persistence, presentation, and accessibility regression coverage.
- Storybook theme controls, visual-manifest validation, representative stories and approved baselines, plus related visual-review documentation.
- No Rust, database, IPC payload, Electron window configuration, external asset, or dependency changes are planned.

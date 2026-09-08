## Why

Storybook visual smoke fails on harmless modal raster variation. CI run 34166000782 differs from its baseline at seven pixels by one color level, exceeding the modal's five-pixel allowance; main run 34162312812 fails the same story's repeated-capture check.

## What Changes

- Reproduce and measure modal variation in the pinned Linux ARM Chromium environment.
- Stabilize capture if a controllable cause is found; otherwise adjust only the modal's allowance to a measured bound, retaining the one-level channel limit.
- Cover the observed variation and rejection of meaningful differences through the existing image-comparison interface and visual command.
- Run the visual subsystem's unit tests, canonical captures, and regression probes.

## Capabilities

### New Capabilities

None. This is test-tooling maintenance; `skip_specs: true` applies.

### Modified Capabilities

None. Product behavior and visual regression policy are unchanged.

## Impact

Scoped to `scripts/storybook-visual/` and `storybook/visual-manifest.json`. No global tolerance increases, automatic baseline refreshes, new dependencies, or product UI changes. Earlier large settings differences are separate from this modal flake and are absent in the latest main report after baseline updates.

## Why

The Storybook visual job in run 34205993615 took 39m18s, including 36m38s after catalog builds. Its 218-case matrix is captured seven times to combine UI coverage with runner regression tests, so every added story increases work unrelated to that story.

## What Changes

- Keep baseline comparison and repeatability coverage for every declared visual case, using the initial capture and one fresh isolated capture.
- Run destructive runner regression probes against a bounded, explicit representative case set rather than the complete catalog, while retaining real-command failure and evidence checks.
- Report phase and case timing data, including failed runs, to measure improvements and identify future bottlenecks.
- Preserve canonical rendering, diagnostics, baseline validation, failure artifacts, and targeted terminal/readiness checks.

## Capabilities

### New Capabilities

- `storybook-visual-execution`: Full-matrix visual verification with bounded runner regression probes and observable execution timings.

### Modified Capabilities

None. The related `ui-storybooks` capability exists only in the active `add-ui-storybooks` change, not in main specs. This change adds execution requirements without editing or duplicating that pending catalog contract.

## Impact

- Affected subsystem: Storybook visual test infrastructure under `scripts/storybook-visual/`, its tests and documentation, and CI artifact reporting if needed.
- Existing root visual commands remain compatible. No production UI, IPC, dependencies, approved baselines, runner architecture, or browser-version changes are intended.
- Concurrency, sharding, network readiness changes, larger runners, and narrower PR story coverage are out of scope.
- A rough 13–15 minute total is a hypothesis based on reducing seven full passes to two, not an acceptance guarantee. Canonical CI measurements will establish the actual improvement.

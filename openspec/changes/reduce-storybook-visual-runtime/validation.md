# Validation evidence

## Scope and review

Validated the Storybook visual infrastructure subsystem, including both catalog builds and its coverage checks. No renderer, Electron, Rust, IPC, dependency, or baseline changes were made. Production subsystem test suites were not rerun because the change is confined to visual tooling; root TypeScript and lint checks were also run.

One fresh read-only review covered tracked and untracked changes against pre-implementation commit `79a53b7dd4a8a576377703f3680ee9b89136671e`. It reported no blocking findings and approved code quality conditional on pinned Linux checks. Those checks subsequently passed. Same-runner CI evidence remains pending.

## Checks run

- `pnpm storybook:visual:unit`: 83 tests across 12 files passed, including new red/green timing, repeatability, probe-selection, input-validation, and restoration tests.
- `pnpm storybook:build`: both catalogs passed.
- `pnpm storybook:coverage`: passed; it still lists existing unadopted catalog inventory.
- `pnpm storybook:coverage:test`: 43 tests passed.
- `pnpm storybook:coverage:check`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed.
- `git diff --check`: passed.
- `pnpm storybook:visual:check`: unchanged retry passed all 218 cases, runner elapsed 218475ms.
- `pnpm storybook:visual:test`: passed all 218 cases and every targeted and runner regression probe, runner elapsed 610619ms.
- Approved images under `storybook/baselines` have no diff. Update behavior was verified only against disposable probe baselines.

## Local Linux measurements

These measurements are from the pinned Linux ARM64 container on the local machine, not GitHub's `ubuntu-24.04-arm` runner. Runner timings exclude container preparation and catalog builds. Do not present these values as the achieved CI reduction from the original 39m18s job.

| Phase | Elapsed |
| --- | ---: |
| Full baseline pass | 310424ms |
| Full repeatability pass | 243972ms |
| Terminal readiness | 31847ms |
| Cursor stability | 11158ms |
| Readiness and diagnostics | 4581ms |
| All runner probes | 8499ms |
| Runner total | 610619ms |

The parent reports 455 attempted captures: 218 baseline captures, 218 repeatability captures, and 19 targeted captures. Of those, 453 completed and two intentionally failed for missing readiness and withheld paint. Their enclosing regression assertions passed.

Each of the intentional-change, update-review, unexpected-diagnostic, and restored child commands captured exactly two cases. Missing-baseline, obsolete-baseline, unexpected-file, and duplicate-identity children captured zero cases and failed validation as expected. Child timing files preserve their expected failure statuses; parent probe records passed after checking those statuses and artifacts.

The full-matrix portion now requires 436 captures instead of 1526 for a 218-case catalog, plus bounded probes and the unchanged targeted regressions.

Current full-test artifacts are in `artifacts/storybook-visual/`. Successful check artifacts were preserved in `/tmp/KVG-4875-retry-check-artifacts`. Local logs are `/tmp/KVG-4875-retry-check.log` and `/tmp/KVG-4875-retry-test.log`.

## Initial failure and follow-ups

The first local check passed 217 cases but failed `pages/pages-task-detail--active--workshop-dark--1280x800`. A play assertion reported `expected true to be false`, followed by a 30-second readiness timeout for `[data-task-terminal-ready=true]`. Timing evidence correctly recorded the failed capture and run. Failure artifacts are preserved in `/tmp/KVG-4875-first-failure`, with log `/tmp/KVG-4875-canonical-check.log`.

No source, capture, tolerance, or baseline changes were made between that failure and the successful check and full test. Its cause remains unconfirmed and is tracked in `KVG-4879`. The separate existing static-server error-reporting issue is tracked in `KVG-4877`.

## Remaining evidence

Task 4.4 remains open. Publish the branch and run the existing Storybook visual workflow on GitHub's `ubuntu-24.04-arm` runner, then compare total and post-build durations with run `34205993615`. The proposal's 13–15 minute figure remains an estimate until that run succeeds.

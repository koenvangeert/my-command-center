# Validation evidence

## Scope and review

Validated the Storybook visual infrastructure subsystem, including both catalog builds and its coverage checks. No renderer, Electron, Rust, IPC, dependency, or baseline changes were made. Production subsystem test suites were not rerun because the change is confined to visual tooling; root TypeScript and lint checks were also run.

One fresh read-only review covered tracked and untracked changes against pre-implementation commit `79a53b7dd4a8a576377703f3680ee9b89136671e`. It reported no blocking findings and approved code quality conditional on pinned Linux checks. Both local pinned Linux validation and same-runner-class CI subsequently passed.

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

## Same-runner CI measurement

[Run 34215563673](https://github.com/koenvg/openforge/actions/runs/34215563673), job `102026380172`, passed on implementation commit `96f805ad`. Both this job and the original job `101995479523` in run `34205993615` used `ubuntu-24.04-arm`.

| Measurement | Original | Optimized |
| --- | ---: | ---: |
| Job total | 39m18s | 13m40s |
| Canonical container step, including builds | 37m44s | 12m34s |
| Post-build verification | 36m38s | 11m29s |

The observed job saving is 25m38s, or 65.2%. Post-build verification fell by about 68.6%. The original post-build duration comes from log timestamps; the optimized value comes from the monotonic timing artifact. This is one successful run of each revision on the same runner class, not a fixed runtime guarantee. The measured total falls within the proposal's 13–15 minute estimate.

CI phase timings were: baseline 299894ms, repeatability 300103ms, terminal readiness 57115ms, cursor stability 13156ms, readiness/diagnostics 4881ms, and runner probes 13803ms. Total runner elapsed time was 689176ms. The two full capture passes remain the main cost at about ten minutes combined; terminal readiness is the next-largest phase. Bounded runner probes now take about fourteen seconds.

Downloaded CI artifacts confirm all 218 baseline comparisons passed, with exactly 218 baseline and 218 repeat captures. Parent counts are 455 attempted, 453 completed, and two expected failures. The four capture-producing child probes each attempted two captures; the four input-validation probes attempted zero. All expected exit codes and evidence checks passed. CI also passed all 83 visual unit/browser tests.

The uploaded `storybook-visual-review` artifact contains the machine-readable reports. A local copy is in `/tmp/KVG-4875-ci-artifacts`; job metadata and logs are `/tmp/KVG-4875-ci-job.json` and `/tmp/KVG-4875-ci-job.log`. No implementation acceptance tasks remain open.

## Rebase validation

Rebased onto main `c38aaf0f7bd340967fd963efd7bd5df1dc56a965`. Main now contains 405 visual cases and additional capture-stability regressions, so the 218-case CI measurements above are historical pre-rebase results, not a claim about current CI duration.

Resolved conflicts in the self-test and visual review guide. Main's eight-sample exact raster checks, runtime-timer freezing, inline/mask SVG checks, delayed terminal focus, and feedback-visibility assertions are retained in `capture-stability.mjs`. The complete matrix still reuses initial captures for its repeat pass. Main's capture implementation and approved baselines are preserved.

Rebased validation passed: 89 visual unit/browser tests, 43 coverage tests, both catalog builds, coverage validation and type check, root TypeScript, and lint. A fresh read-only conflict-resolution review found no blocking findings.

The full pinned Linux self-test passed all 405 cases, both matrix passes, targeted regressions, and bounded child-command probes. Runner elapsed time was 940028ms locally. Parent timings show 881 attempts, 879 completed captures, and the two expected readiness-failure captures. The new capture-stability phase passed in 57766ms. Log: `/tmp/KVG-4875-rebase-visual.log`; latest artifacts: `artifacts/storybook-visual/`. These are local results; post-rebase PR CI will run after pushing.

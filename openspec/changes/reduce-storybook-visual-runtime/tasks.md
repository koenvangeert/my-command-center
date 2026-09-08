## 1. Timing evidence

- [x] 1.1 Add failing tests for timing records, capture counts, nested phase accounting, and partial failure output using a controlled clock; verify the tests fail for missing reporting behavior before implementation.
- [x] 1.2 Implement additive `timings.json` output and bounded phase/slowest-capture logging for initial captures, repeats, targeted checks, and child probes; verify timing tests pass and existing result/report formats remain unchanged.

## 2. Reuse initial captures

- [x] 2.1 Add failing tests proving each full-matrix repeatability check reads the initial run artifact and takes exactly one fresh capture, rejects missing artifacts, validates fresh diagnostics, and retains mismatch evidence; verify failure before changing the self-test.
- [x] 2.2 Replace the redundant repeatability capture with the persisted initial screenshot; verify the new tests pass with existing comparator/tolerance behavior and independent browser-context setup intact.

## 3. Bound runner regression probes

- [x] 3.1 Pin a representative page identity and a component identity with a visible injectable button, and add failing tests for exact selection, missing/duplicate identities, and constant selection size after unrelated manifest growth; verify tests exercise both catalogs.
- [x] 3.2 Implement disposable reduced-manifest and matching baseline preparation plus a restricted child-only manifest override; verify selection tests pass and malformed paths, incomplete override combinations, and test-mode overrides fail before writes.
- [x] 3.3 Route pixel-change, update-evidence, diagnostic, restored, missing-baseline, obsolete-baseline, unexpected-file, and duplicate probes through disposable inputs; verify real-command exit codes and review evidence remain asserted and successful capture probes each use exactly two cases.
- [x] 3.4 Add regression tests for invalid non-probe cases in normal full-manifest mode and restoration after injected failures; verify no normal command narrows coverage and original manifest, build output, and approved baselines remain intact.
- [x] 3.5 Retain all targeted terminal, CPU-throttling, withheld-paint, cursor, readiness, and exact-diagnostic regressions; verify their assertions still execute in the complete canonical test.

## 4. Documentation and affected-system validation

- [x] 4.1 Update `docs/storybook-visuals.md` with the two-pass model, representative-probe scope, timing artifact format, and unchanged public commands; verify documented names and outputs against a completed run.
- [x] 4.2 Run `pnpm storybook:visual:unit`, `pnpm storybook:build`, `pnpm storybook:coverage`, `pnpm storybook:coverage:test`, and `pnpm storybook:coverage:check`; review CONTRIBUTING.md against the complete diff and run any additional affected-subsystem static or contract checks it requires, recording results and gaps.
- [x] 4.3 Run `pnpm storybook:visual:check` and `pnpm storybook:visual:test` in the pinned Linux environment; verify full-matrix comparison, two full capture passes, bounded child probes, all targeted regressions, partial failure timing evidence, and byte-identical approved baselines. Verify update compatibility only in disposable probe storage.
- [ ] 4.4 Obtain a successful same-runner-class CI measurement and compare total and post-build duration with run 34205993615; deliver actual phase timings, capture counts, and remaining bottlenecks, explicitly distinguishing the 13–15 minute estimate from measured performance.

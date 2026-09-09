## Context

See proposal.md for the measured job and motivation. `run.mjs` captures the full manifest once, then `self-test.mjs` takes two new captures per case and invokes four more successful full-capture child commands. Other children reject invalid inputs before capture. The existing targeted terminal and cursor checks are separate and stay intact.

The runner validates manifest identities against built indexes and validates baseline inventory before capturing. Probe output and baseline overrides already restrict writes to disposable container paths. Normal commands must preserve these protections. The related catalog specification remains in the active `add-ui-storybooks` change; do not modify that change.

## Goals / Non-Goals

**Goals:**
- Reduce successful test work from seven full passes to two plus a fixed number of probe captures.
- Retain the real command as the subject of runner regression tests.
- Make elapsed work attributable without relying on log silence or wall-clock thresholds in unit tests.

**Non-Goals:**
- Parallel captures, changes to screenshot settling or `networkidle`, baseline regeneration, and changes to canonical browser flags.
- A public case-filter option or moving regression checks out of PR validation.

## Decisions

### Reuse persisted initial captures

Read each initial `current.png` from the parent run's existing output and compare it with one fresh isolated capture during repeatability verification. The first sample has already passed diagnostics; validate diagnostics on the fresh sample as well. Keep the existing repeatability comparator, tolerances, and failure artifacts. A missing initial artifact is an error, never an excuse to take an untracked replacement capture.

This avoids retaining the full screenshot matrix in memory and preserves the current separation between baseline comparison and self-tests. Taking a third sample adds cost without being necessary for a two-sample repeatability assertion.

### Give child probes a disposable reduced manifest and matching baseline inventory

Define exactly two representative identities, one page case and one component case with a visible button affected by the existing pixel injection. Pin complete identities including theme and viewport, not array positions. Resolve them from the validated parent manifest and fail explicitly if missing or ambiguous. Confirm the component actually changes pixels through the existing real-command assertion.

Prepare a disposable manifest and baseline directory containing only those identities. Add an internal probe-manifest override accepted only with the existing disposable baseline and self-test output paths, and only for child `check` or `update` modes. Normal root commands continue using the complete repository manifest and inventory. Reject malformed override combinations before writes. No public filter is introduced.

Children still execute manifest, index, and inventory validation, capture, comparison, diagnostics, reporting, and update behavior. Missing, obsolete, unexpected-file, and duplicate probes modify only their disposable inputs. Pixel and diagnostic injection still temporarily modify container build output, with restoration in `finally`; verify restoration with the reduced pair. Child execution remains serial because injected build output is shared.

This is preferable to filtering after full baseline validation, which mixes two different inventories, and to rewriting the parent manifest, which risks leaking reduced coverage into later checks. Full-inventory validation gets explicit tests for invalid non-probe cases.

### Keep targeted regressions independent

Leave terminal CPU-throttling, withheld-paint readiness, cursor stability, missing-readiness, and exact-diagnostic checks in place. They are not replaced by the representative pair. Adding unrelated cases must not grow runner probe capture counts; intentional changes to the pair require review.

### Add bounded timing records

Use a monotonic clock for elapsed measurements. Write an additive `timings.json` artifact per command, leaving existing `results.json` and HTML report consumers compatible. Records include phase, case or probe identity, elapsed milliseconds, status, and capture counts; totals distinguish parent wall time from nested child work to avoid double counting.

Measure initial captures, repeat captures, targeted regression groups, and each child invocation. Child artifacts supply their own capture details. Log phase starts/completions and a bounded slowest-capture summary. Flush partial timing evidence on handled failures from finalization; reporting failure must never suppress the original verification failure. Hard runner termination cannot guarantee final artifact writes and is not covered by that guarantee.

Unit tests assert record structure, statuses and counts with controlled clocks, not actual speed. CI supplies the performance evidence.

## Risks / Trade-offs

- Representative probes exercise fewer UI variants. Mitigation: keep full-matrix baseline and repeatability checks, both catalogs in the pair, and all specialized regressions.
- A reduced-input override could accidentally bypass full checks. Mitigation: make it internal and path-restricted, reject incomplete combinations, and test invalid cases outside the pair in normal mode.
- Persisted screenshots could be missing or stale. Mitigation: retain run-output cleanup and require the current run's initial artifact for each identity.
- Probe mutations can survive exceptions. Mitigation: disposable inputs, serial execution, `finally` restoration, and failure-path tests.
- Timing I/O can add overhead. Mitigation: bounded records, per-phase logging rather than per-operation logging, and no extra captures for measurement.
- The 13–15 minute estimate may not hold on shared runners. Mitigation: report actual same-class Linux ARM64 CI timing, capture counts, and remaining slow phases; do not weaken assertions to meet a target.

## Migration Plan

1. Add tests and timing instrumentation, then replace redundant repeat captures and reduce child probe inputs.
2. Run all affected Storybook visual infrastructure checks, both catalog builds and applicable coverage/static checks. Run the complete pinned Linux visual test, including every fault probe.
3. Verify approved baselines remain byte-identical and normal check/update behavior remains compatible, with update verification confined to disposable storage.
4. Compare successful CI elapsed time and capture counts against run 34205993615 on the same runner class. Aim for roughly 13–15 minutes, documenting measured results rather than promising a fixed SLA.
5. Update the visual review guide with probe scope and timing artifacts. Roll back runner changes if coverage or determinism regresses; no baseline or data migration is required.

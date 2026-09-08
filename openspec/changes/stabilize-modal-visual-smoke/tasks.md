## 1. Reproduce

- [x] 1.1 Confirm the comparison and canonical-command test seams with the user before writing tests; record the pre-implementation commit for review. Confirmed by the apply request; baseline `2844b4cb8ba2058eb27165a9a9b37934efe92808`.
- [x] 1.2 Measure archived modal images and repeated pinned Linux ARM captures, including pairwise comparisons; record pixel counts, maximum channel deltas, and whether a controllable capture-state cause exists. Thirty fresh captures plus baseline, 465 comparisons: maximum seven pixels at one channel level, matching CI at the same seven corner coordinates. No capture-state cause demonstrated.

## 2. Fix the modal flake

- [x] 2.1 Add a failing regression at the agreed public seam for the observed variation, then apply the smallest evidence-backed capture or modal-policy fix; verify the regression changes from red to green without changing global thresholds. Archived CI pair failed at five pixels and passed at seven; channel ceiling remains one.
- [x] 2.2 Add rejection coverage for differences above the modal pixel bound, above its one-level channel bound, and under the default exact policy; verify focused comparison tests pass. All 12 focused tests pass.

## 3. Validate and review

- [x] 3.1 Run all visual subsystem unit tests and applicable static checks from the testing guide, plus `pnpm storybook:visual:test`; verify canonical baseline checks, repeatability checks, and intentional-regression probes pass, and disclose any coverage gap. Passed: 50 visual unit tests, TypeScript, lint, syntax, and all 186 canonical cases with repeatability and regression probes. No visual-subsystem validation gaps; unrelated product and Rust suites were not run.
- [x] 3.2 Run the required fresh-context review against the recorded baseline, resolve or report findings, update task Handoff Notes, and commit the focused change after completion gates pass; verify the final diff and working-tree status. Review found no code issues; canonical condition satisfied. Handoff Notes updated, focused commit created, and clean status verified. Cleanup KVG-4853 tracks repeatability failure evidence separately.

## Context

See proposal.md for motivation. The visual runner uses pinned Linux ARM Chromium. `compare(baseline, current, tolerance)` enforces both a changed-pixel count and a maximum channel delta. The modal currently allows five pixels at one channel level. The repeatability self-test uses that same allowance for two independent captures.

## Goals / Non-Goals

Goals:
- Make the modal check accept measured raster noise without accepting meaningful visual changes.
- Verify both baseline comparisons and comparisons between independent captures.

Non-goals:
- Changing global comparison behavior, hiding regions, adding retries, or updating unrelated baselines.
- Fixing product styling to satisfy a screenshot.

## Decisions

- Measure before changing the allowance. Compare archived CI images and repeated canonical captures, including pairwise comparisons. A single baseline comparison does not establish a bound for repeatability.
- Prefer eliminating a demonstrated capture-state cause. If the variation remains bounded raster noise, change only this modal manifest entry and document the evidence. Retain the one-level channel ceiling; do not guess a generous pixel budget.
- Proposed test seams are the existing public `compare` function with the manifest-resolved modal policy, and `pnpm storybook:visual:test`. Cover the observed seven-pixel case, out-of-bound pixel counts, stronger color changes, and the default exact policy. Confirm these seams before writing tests.
- Use the existing canonical full-suite command to verify the change across stories. Do not replace that validation with host-platform screenshots.

## Risks / Trade-offs

- Limited sampling can underestimate noise. Mitigate with repeated captures, pairwise comparisons, and archived CI evidence; retain a narrow documented allowance rather than broad tolerance.
- A tolerance can hide real changes within its limits. Mitigate by keeping the channel ceiling and testing rejection above either bound.
- Docker or the pinned image may be unavailable locally. Report that as a validation blocker rather than claiming host-only tests prove CI stability.

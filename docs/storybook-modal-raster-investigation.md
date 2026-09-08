# Modal Save-button raster variation

## Failure

After merging the settings baseline fix from main into KVG-4835, the full 186-case visual check failed only for `components/sdk-overlays--modal--openforge-light--800x600`. Seven pixels differed from the approved baseline by one RGB channel level. The existing allowance covered five pixels at one level.

The differences were confined to the Save button's antialiased corners. No layout, content, focus state, or control geometry changed.

## Capture environment

The investigation used the production `capture()` and `serve()` helpers from `scripts/storybook-visual/capture.mjs`, the unchanged manifest entry, and the browser launch options from `run.mjs`.

- Image: `mcr.microsoft.com/playwright:v1.62.1-noble@sha256:941cc91e5022880ac1d14ae90b476b624deb6399dbbc28d612d5d5bd7928fcbd`
- Chromium: `151.0.7922.34`
- Linux ARM64, device scale 1, en-US, UTC, fixed application time, loaded fonts, frozen motion and blocked external requests.
- Both catalogs were built inside the container from the frozen lockfile.
- npm registry connection timeouts required mounting the matching pnpm 10.34.3 JavaScript distribution and using the existing Linux package store offline. No host application dependencies or browser binaries were reused.

## Measurements

Eight consecutive captures used fresh browser contexts. All passed the entry's readiness and exact diagnostic checks. Comparing each capture to the approved baseline produced these changed-pixel counts:

| Capture | Changed pixels | Maximum channel delta |
| --- | ---: | ---: |
| 1–7 | 0 | 0 |
| 8 | 7 | 1 |

All 36 pairwise comparisons among the eight captures and the baseline stayed within seven pixels and one channel level. The changed coordinates were:

```text
172,401  173,401  625,401  626,401  627,401
172,402  625,402
```

Each changed RGB channel decreased by exactly one level; alpha stayed at 255. The first five pixels changed from 32 to 31, then 139 to 138 and 45 to 44 at the remaining two coordinates.

To repeat the historical measurement, use revision `214006c1` in a disposable checkout. Build both catalogs in the pinned container, select the light `sdk-overlays--modal` manifest entry, and call `capture(browser, server.url, entry)` eight times. Verify each capture with `verifyDiagnostics`, then compare RGBA bytes against the approved PNG and every other capture. Preserve coordinates and maximum channel differences, not just screenshot pass/fail status.

## Bound

KVG-4835 increased only this entry's pixel-count allowance from five to seven, retaining its one-level channel bound and approved PNG. That allowance was superseded by the [KVG-4819 primary-button paint fix](storybook-visuals.md#modal-ci-follow-up): the redundant border paint is removed and both SDK modal cases now require exact comparison. The measurements above describe the earlier implementation.

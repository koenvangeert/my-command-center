# Modal raster noise evidence

`baseline.png` and `current.png` are the unmodified modal images from [CI run 34166000782](https://github.com/koenvg/openforge/actions/runs/34166000782), artifact `storybook-visual-review`, case `components/sdk-overlays--modal--openforge-light--800x600`.

The pair differs at seven pixels, with a maximum RGBA channel delta of one:

```text
172,401  173,401  625,401  626,401  627,401  172,402  625,402
```

The previous five-pixel allowance rejected this pair. The latest main run examined, 34162312812, passed its baseline checks but failed the modal repeatability assertion. That assertion did not retain its two images, so its exact pixel count is unknown.

## Canonical reproduction

On 2026-09-08, build both catalogs with the frozen lockfile in the pinned Playwright image from `container.mjs`, Linux ARM64 digest `sha256:941cc91e5022880ac1d14ae90b476b624deb6399dbbc28d612d5d5bd7928fcbd`. Chromium reported `151.0.7922.34`.

Using the unchanged `capture` and `serve` exports, the modal's manifest entry, and the runner's launch arguments `--disable-gpu` and `--force-color-profile=srgb`, take 30 captures, each in a fresh context. Compare all pairs among these captures and the committed baseline using `compare`. Separately scan PNG channel bytes to measure maximum channel delta.

All 465 comparisons stayed within seven changed pixels and one channel level. The union of differing coordinates was exactly the seven coordinates above. No timing or readiness cause was demonstrated. This reproduces the CI variation without changing the capture path, so only the light modal's allowance increases to seven pixels. The dark locked modal, global limits, and baselines are unchanged.

`modal-raster.test.mjs` reads these fixed CI images and the actual manifest policy. It verifies acceptance of the observed pair and rejection of an eighth pixel, a two-level change at one pixel, and the same pair under the default exact policy. The PNGs are regression inputs, not replacement visual baselines.

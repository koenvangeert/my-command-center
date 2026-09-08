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

All 465 comparisons stayed within seven changed pixels and one channel level. The union of differing coordinates was exactly the seven coordinates above. No timing or readiness cause was demonstrated. This historical investigation supported a seven-pixel allowance for the light modal. KVG-4819 subsequently removed the redundant primary-button border paint and retired the modal allowances; both modal cases now require exact comparison. The reproduction instructions above describe the pre-fix implementation.

`modal-raster.test.mjs` reads these fixed CI images and the actual manifest policy. It verifies that the modal has no allowance and rejects the archived pair, an eighth changed pixel, and a two-level change at one pixel. The PNGs remain regression inputs, not replacement visual baselines.

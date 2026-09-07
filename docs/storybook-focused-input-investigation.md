# Focused-input capture investigation, KVG-4816

## Outcome

The reported two-pixel variation did not recur in this checkout. Keep the existing File quick-open / Unavailable allowance. Do not add capture delays, warm-up screenshots, raster-thread flags, or production styling changes without a reproducing control.

This verifies the existing workaround, not deterministic rasterization. The experiments cannot distinguish a stable capture path from an intermittent problem that did not occur during this sample.

## Starting state

Investigation started at `cd729e5b`, after merging KVG-4695. Contrary to the original task prompt, commit `d1106014` already introduced:

- A `maxPixels: 2`, `maxChannelDelta: 3` allowance for `pages-file-quick-open--unavailable`, `openforge-dark`, `1280x800`.
- Shared manifest validation allowing delta three for allowances of at most two pixels. Larger allowances remain capped at delta two and 20 pixels. Undeclared comparisons remain exact.
- Documentation attributing the two-pixel allowance to KVG-4816.

The reason records differences at x=389, y=339 and x=391, y=339, with channel deltas three and one. These coordinates are historical evidence supplied by the task and the existing manifest, not a result reproduced here. The referenced KVG-4695 worktree artifact directory was not available at `/Users/koen/.openforge/worktrees/openforge/KVG-4695/artifacts/storybook-visual`.

Owner approval covered shared-runner experiments. No tracked runner, manifest, baseline, or production code changed during this investigation.

## Capture experiments

All captures used the repository's pinned Linux arm64 Playwright 1.62.1 Noble container:

`sha256:941cc91e5022880ac1d14ae90b476b624deb6399dbbc28d612d5d5bd7928fcbd`

Both Storybook catalogs were built inside the container from the frozen lockfile. The probe called the existing `capture()` function with the target manifest entry, retained its readiness and font checks, and used the canonical browser arguments `--disable-gpu` and `--force-color-profile=srgb`.

Each variant used one fresh browser and 20 sequential captures, each in a fresh browser context. Comparisons inspected every decoded RGBA channel against the committed baseline, without applying its tolerance.

| Variant | Extra capture behavior | Captures | Pixels differing from baseline |
| --- | --- | --- | --- |
| Control | None | 20 | 0 in every capture |
| Settle | Two animation frames and a discarded screenshot before normal final capture | 20 | 0 in every capture |
| Single raster thread | Browser launched with `--num-raster-threads=1` | 20 | 0 in every capture |

All 60 images had the same decoded-pixel SHA-256:

`8cc2ec00e533e47dddbf74c5a16e49de672f329576abc904e6cd05660a8e230e`

All captures returned no console or page-error diagnostics. The control was already exact, so neither experimental variant demonstrated an improvement. Repeated screenshots in one browser per variant do not establish stability across independent container builds or CI hosts.

## Verification

- `pnpm i` succeeded without tracked dependency changes.
- `pnpm storybook:visual:unit` passed all 31 tests across four files.
- `pnpm storybook:visual:check` passed all 117 cases. The affected story matched its baseline exactly.
- `pnpm storybook:visual:test` passed all 117 cases, repeated-capture checks, deliberate regression rejection, update evidence, diagnostic artifacts, readiness checks, exact diagnostic matching, and restoration.

The full visual checks use manifest allowances. Their success does not imply every story matched exactly. No app-wide TypeScript, renderer, Electron, or Rust checks were run because no executable project files changed.

## Allowance recommendation

Retain the existing allowance only on this manifest identity: at most two changed pixels, each with channel delta at most three. Keep raw difference images and counts visible in reports. Do not regenerate its baseline or increase other stories' tolerances on the strength of these results.

The existing allowance bounds count and magnitude, not location. It can accept two small changes elsewhere in this screenshot. If location-specific rejection is required, a separate implementation should restrict the exception to the two recorded coordinates with respective delta caps three and one, leaving all other pixels exact. That change needs tests rejecting nearby pixels, a third changed pixel, excessive channel deltas, and use on another story, theme, or viewport. The present experiments do not justify a broader allowance or a claim that such an exception is necessary.

## Local evidence

Ignored artifacts are retained in `artifacts/storybook-visual/KVG-4816-investigation/`:

- `initial-check/`: the first complete canonical comparison report.
- `probe.mjs`: the disposable experiment, run as `/work/probe.mjs` inside the pinned container with `/evidence` mounted to this artifact directory and `/baselines` mounted read-only.
- `probe.log`, `results.json`, and `control/`, `settle/`, `single-raster/`: experiment output, per-capture measurements, and all 60 PNGs.
- `visual-test.log`: full visual self-test output.

The final canonical report and deliberate regression evidence are in `artifacts/storybook-visual/`. These local artifacts are not committed; preserve them before another run overwrites them.

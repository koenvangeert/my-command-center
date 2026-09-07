# Review screenshot changes

The manifest includes foundation, host chrome, Plugin SDK, terminal, and navigation/search cases. See [host chrome and feedback](storybook-host-chrome.md), [SDK composite layouts](storybook-sdk-composites.md), and [navigation workflows](storybook-navigation.md) for their adopted states and interaction checks. It does not enforce coverage of the remaining Storybook catalog.

## Built-in themes

OpenForge Light and OpenForge Dark use the Studio design: neutral surfaces, rounded controls, and restrained shadows. They retain their names and `openforge-light` / `openforge-dark` identifiers, so saved selections and legacy light/dark preferences receive the redesign without migration. The default and unavailable-theme fallback remain OpenForge Light.

Workshop Light and Workshop Dark are additional choices with warm paper or graphite surfaces, amber actions, and crisp corners. There are no separate Studio choices or accepted `studio-light` / `studio-dark` capture IDs. Theme selection does not override the user's terminal font.

Glass and in-app frosted layers remain deferred. No native transparency or backdrop blur is included.

## Commands

Run from the repository root with Docker running:

```sh
pnpm i
pnpm storybook:visual:check
pnpm storybook:visual:update
pnpm storybook:visual:test
pnpm storybook:visual:unit
```

`check` builds both catalogs in a disposable Linux container and compares them with `storybook/baselines`. It mounts the checkout and approved images read-only. Current images, differences, environment details, and `index.html` go to ignored `artifacts/storybook-visual`. Each run replaces the previous artifacts. Do not run these commands concurrently.

`update` uses the same capture path but writes only the images selected by `storybook/visual-manifest.json`. It validates all selected captures before writing any of them. It lists obsolete PNGs without deleting them. Review and remove obsolete images explicitly, then run `check`. Never update screenshots just to silence a failure.

`test` first checks the selected baselines, then proves repeated capture of every case stays within its declared bounds. It changes a button's color in disposable container build output, requires the real check command to fail, and saves its before/current/difference report at `artifacts/storybook-visual/self-test/intentional-change/index.html`. It also probes update evidence, missing readiness, unexpected console errors with preserved screenshots, exact declared failures, and restoration. `unit` tests manifest validation, missing stories, duplicate identities, missing/obsolete/unexpected baselines, pixel comparison, report escaping, and SVG-mask freezing without Docker.

For native interactive development use `pnpm storybook:pages` or `pnpm storybook:components`. Native screenshots are not canonical baselines.

The visual unit command also exercises native media capture in local Chromium. Install it with `pnpm exec playwright install chromium` after dependency upgrades. These tests compare repeated captures within one environment; they do not approve repository baselines.

## Approving a change

1. Run `check` and open `artifacts/storybook-visual/index.html` in a browser.
2. Inspect the baseline, current, and difference images at full size. Resolve unexpected errors or missing readiness before approving pixels.
3. For an intentional change, run `update`, inspect the Git image diff, then run `check` again.
4. Commit the selected PNGs together with the story or UI change. Generated comparison artifacts stay out of Git.

CI runs the same Linux command on affected UI pull requests and main-branch pushes. Download `storybook-visual-review` from the workflow run, extract it, and open `index.html`. The artifact includes the deliberate regression probe report even on success and is retained for 14 days.

## Manifest contract

Each entry declares `catalog`, stable Storybook `story` ID, `theme`, integer `viewport.width` and `viewport.height`, a visible Playwright `ready` selector, and `expectedErrors`. Catalogs are limited to `pages` and `components`. Accepted theme IDs are `openforge-light`, `openforge-dark`, `workshop-light`, and `workshop-dark`. Unknown fields and theme IDs fail rather than being ignored.

Images are named `<catalog>/<story>--<theme>--<width>x<height>.png`. Renaming an identity makes the old PNG obsolete; removing a story from the built index fails with that story's identity. Missing images never become approvals during `check`. Unexpected files in the baseline directories fail both modes.

Readiness must identify the intended final state, not just a generic root element or spinner. Interactive cases must choose a selector that proves their interaction has finished, such as the host context menu's visible menu. Deliberately failed cases must list complete console/page-error messages in `expectedErrors`, including multiplicity. Missing expected messages fail too. No substring allowlist is used.

Comparison is exact by default. Per-entry rasterization allowances require measured evidence and a reason, ordinarily capped at 36 changed pixels and two channel levels. Selected board, shell, review, and component cases declare measured antialiasing allowances in the manifest. Reports retain raw counts and difference images, including accepted noise. Loading remains exact: animation is frozen, never masked by a tolerance. Main's separate navigation allowance permits up to three channel levels only when at most two pixels change, for the measured dark File quick-open / Unavailable input-corner noise (KVG-4816). Larger pixel counts cannot use three levels. Navigation palette controls and Project switching / Empty remain exact; SVG motion is frozen rather than tolerated. All cases without an explicit allowance use exact comparison.

See the [KVG-4816 focused-input investigation](storybook-focused-input-investigation.md) for capture experiments, verification results, and the limits of the existing two-pixel allowance.

Captures use a 30-second default operation/navigation deadline. Failure probes can still request shorter deadlines. Full-manifest child probes have at least two minutes and scale by 30 seconds per selected case, so adopting more stories does not exhaust the original two-case timeout.

## Canonical environment

`scripts/storybook-visual/container.mjs` pins the Playwright 1.62.1 Ubuntu Noble image by its Linux arm64 digest. Local Docker and CI's `ubuntu-24.04-arm` runner use that same architecture. Apple Silicon runs it natively; Intel developers need Docker ARM emulation or an ARM Docker host. We do not maintain separate architecture baselines. The frozen workspace lockfile selects Playwright and bundled production fonts. Both catalog builds and browser captures happen inside that container; host `node_modules` is excluded.

Capture fixes Chromium, device scale 1, en-US locale, UTC timezone, application time at `2026-01-02T09:30:00.000Z`, theme/color scheme, reduced motion, disabled CSS animations/transitions, hidden caret, and loaded fonts. Animated SVG masks are derived from the production SVG at their terminal values because CSS reduced motion does not stop embedded SMIL. External browser requests are blocked. Each case gets a fresh browser context. Comparison includes antialiasing pixels with zero threshold.

After readiness and motion suppression, capture requires two consecutive screenshots with identical decoded pixels, separated by a browser paint boundary. This avoids transient raster paints and duplicate reads of the same frame even when the DOM is ready. Capture fails if pixels do not settle within the capture timeout. This check does not consult the baseline or apply a tolerance; persistent visual changes still fail baseline comparison.

For native video controls, capture waits for a decoded frame or a real media error and requires the story to leave playback paused. In both cases, the native buffering panel must finish before capture freezes animations in Chromium's nested control shadow roots through CDP. It does not replace players, remove controls, synthesize errors, or broaden pixel tolerances. Those changes live only in the disposable capture context.

When upgrading Playwright, update the lockfile and image digest together, regenerate the selected baselines in the container, and review them. `environment.json` in each report records the image and actual Chromium version. The first run downloads the container and installs dependencies, so it needs network access and may take several minutes.

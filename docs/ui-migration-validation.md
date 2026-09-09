# KVG-4863 validation and baseline evidence

Base commit: `58dbaf2df1b6d16dc0f80c3afa3f75675a566e88`. No legacy caller migration, settings business-logic change, theme-schema change, SDK export change, or compatibility removal is included.

## Validation scope

The task adds shared host CSS and extends test tooling. Validation covers the host renderer, SDK publication contract, PR review UI, terminal runtime, and the four affected bundled plugins. Root tests include first-level workspace tests. Rust, mobile and website builds are outside the changed systems. All commands below ran from the worktree unless a filter selects a package.

| Command | Result |
| --- | --- |
| `pnpm i` | Passed. Ignored build scripts for `@vgpu/adapter-node`, `esbuild`, and `webgpu`; no approvals changed. |
| `pnpm test --maxWorkers=4 --testTimeout=30000` | Passed after review fixes: 769 files, 6,416 tests; 5 files and 22 tests skipped. |
| Focused inventory, semantic utilities, and baseline measurement suites | Passed: 31 tests across 3 files. |
| Host baseline collector | Captured 168 cases; 12 document the existing narrow self-review clipping gap. |
| Token-only SDK baseline collector | Captured 12 cases, including the existing unstyled spinner dependency. |
| `pnpm lint` | Passed, including the existing migration enforcement gate. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm build` | Passed. |
| `pnpm --filter @openforge-app/plugin-sdk test` | Passed. |
| `pnpm --filter @openforge-app/plugin-sdk build` | Passed, including `check:entrypoints` and assets. |
| `pnpm --filter @openforge-app/plugin-sdk check:contract` | Passed. Existing packed SDK contract retained. |
| `pnpm exec vitest run packages/pr-review-ui` | Passed. |
| `pnpm --filter @openforge-app/pr-review-ui check` | Passed. |
| `pnpm --filter @openforge-app/terminal-runtime test` | Passed. |
| `pnpm --filter @openforge-app/terminal-runtime build` | Passed. |
| `pnpm --filter @openforge-app/terminal-runtime conformance` | Passed. |
| GitHub sync `test` and `typecheck` | Passed via `pnpm --filter @openforge-app/plugin-github-sync`. |
| File viewer `test` | Passed via `pnpm --filter @openforge-app/plugin-file-viewer`. |
| Task browser `test` and `typecheck` | Passed via `pnpm --filter @openforge-app/plugin-task-browser`. |
| Terminal plugin `test` | Passed via `pnpm --filter @openforge-app/plugin-terminal`. |
| `pnpm build:plugins` | Passed. Builds the SDK and every bundled plugin's `build:bundle`. Separate plugin `build` scripts wrap these same builds. |
| `pnpm storybook:visual:check` | Passed: 405 canonical Linux captures, no baseline updates. |
| `node scripts/check-settings-themes.mjs --compatibility-only` | Passed: six selected themes plus one contributed-theme reload. Legacy and semantic paint, stable IDs, focus and edited input retained. |
| `node scripts/check-settings-themes.mjs` | Pre-existing failure before shared CSS changes: OpenForge Light control radius is 8px, while the check expects 3px. Follow-up KVG-4888. Existing assertions remain unchanged. |

The focused scanner was test-driven from 15 existing tests to 27 tests. Review reproductions for spreads, mutable bindings, variant feedback classes, and script component producers failed before their fixes. A browser regression test requires named feedback targets and rejects missing, invisible, or zero-width-ancestor-clipped feedback, even when many shell controls precede it. Documented existing gaps require explicit per-case reasons.

The semantic browser tests first failed with transparent/default paint before namespace definitions existed, then passed. Coverage includes all 17 roles, inventoried production color families, chained/arbitrary interaction variants, numeric opacity forms, ring offsets and gradients, local runtime token changes, child opacity, and production source discovery.

Under concurrent machine load, the existing subprocess-heavy scanner discovery test exceeded its unchanged five-second Vitest deadline. The final full suite uses a command-line 30-second deadline and bounded workers; repository timeout configuration is unchanged. An earlier 200-second execution-window interruption is not counted as a pass.

File viewer and terminal plugins have no separate typecheck script. The root suite's five opt-in skips are `FocusBoard.browser.test.ts`, `ProjectSidebarList.browser.test.ts`, `navigation.browser.test.ts`, `RichMarkdownDiff.visual.test.ts`, and `InteractionOverlays.visual.test.ts`. These require explicit service URLs or environment flags. Skipped tests are not presented as passed; canonical screenshots, migration-specific browser assertions, and terminal conformance ran separately.

## Browser evidence

- Canonical paint baseline: `pnpm storybook:visual:check` built both catalogs in the pinned Linux container and matched all 405 approved captures. Report: `artifacts/storybook-visual/index.html`; environment and timing details accompany it. No screenshots or tolerances were updated.
- Host computed baseline: [ui-migration-baseline.json](ui-migration-baseline.json), 168 Chromium cases: 14 story states × two viewports × six themes. It covers attention loading/error, self-review loading/error, task review, file loading/error, terminal unavailable feedback, settings loading/saving, and project-setup empty/error/success states. Each case selects named feedback/spinner/retry/form targets; it never samples the first document elements.
- Theme matrix: OpenForge Light → OpenForge Dark → `com.example.ink:ink` → Workshop Light → Workshop Dark → `com.example.copper:copper`, applied through the registry without remounting each view. Selection must preserve keyboard focus. Supported retry and project-setup controls record hover, pressed, and focus-visible paint; selected and disabled project-setup controls are also measured.
- Token-only SDK baseline: [ui-migration-sdk-baseline.json](ui-migration-sdk-baseline.json), 12 cases at 640px and 320px across the same six themes. Actual SDK controls and `PluginViewState` mount with theme tokens and bundled fonts, but no host stylesheet, Tailwind, or adapter CSS. Disabled, selected, invalid, loading, error, status, and focused controls are measured. The invalid field's containing control is measured as well as its native input.
- Both files record actual theme IDs, viewport, browser version, font readiness and typography, colors, opacity, outlines, bounds, wrapping/scroll measurements, accessibility state, focus, mask, and animation properties. They complement rather than replace pinned raster baselines.
- Real theme selection: existing settings fixture and registry path, Light → Dark → `com.example.ink:ink`, all four built-ins, and `com.example.copper:copper`. Copper uses a different palette and radius and reloads through the registry's supported plugin-reload path. Edited input and focus survive the reload.
- Utility paint: the compiled matrix compares with independently styled direct-token swatches. The host integration probe keeps the adapter installed. The isolated utility matrix excludes the adapter's unlayered outline override so it can measure the utility declarations themselves.

Record and compare unchanged bounds with a maximum tolerance of one CSS pixel. Do not widen this without a measured, reviewed rounding explanation. The current namespace is unused by legacy views, so these remain pre-consumer-migration measurements even though the additive stylesheet is present.

To reproduce native computed measurements, start a pages server from this worktree on a known free port, then pass that exact URL:

```sh
pnpm exec storybook dev --ci -p 6186 -c storybook/pages
STORYBOOK_URL=http://localhost:6186 UI_MIGRATION_BASELINE=docs/ui-migration-baseline.json node scripts/capture-ui-migration-baseline.mjs
UI_MIGRATION_BASELINE=docs/ui-migration-sdk-baseline.json node scripts/capture-sdk-migration-baseline.mjs
```

The recorded run used port 6186. An initial 6006 attempt reached another worktree and was discarded. A subsequent local server had stale optimizer assets after package builds; restarting on the explicit port produced the recorded measurements. The collector requires an explicit URL and verifies the selected theme to avoid silently recording Light for every request.

## Remaining evidence gaps

- The original 929/905 scan commands and occurrence lists are unavailable. The exact historical 24-reference attribution remains unresolved; the refreshed ledger and scan-definition comparison are documented in the inventory.
- Twelve narrow self-review cases record a zero-width diff-pane ancestor at 1000px. Feedback descendants can have nonzero bounds yet remain clipped; `clippedByZeroAncestor` records this separately from Playwright visibility. These are documented failures, not successful narrow presentation. The same existing problem was reproduced at 900px and logged as KVG-4897. Wider self-review cases require visible feedback and spinner/retry targets.
- The token-only SDK fixture records the current `PluginViewState` spinner with no mask and no visible size without legacy host CSS. This is the dependency KVG-4865 must remove, not a proposed visual target for the new spinner. Host loading baselines retain the current styled-spinner reference.
- Baselines cover the stated representative cases and supported interactions, not every possible view/state combination. Canonical screenshots cover additional states, but only built-in themes.
- The full settings browser check remains blocked by its pre-existing radius expectation. Compatibility-only success does not make that full check pass.
- Dynamic records and script candidates remain visible for manual review. They must not be treated as a zero-consumer gate.

KVG-4888 and KVG-4897 track the unrelated settings-check and narrow-layout investigations. The parent task was not changed.

## Review disposition

One fresh-context review covered the complete working-tree diff, including untracked files, against the base above. Its four findings were addressed without another review pass:

1. Replaced document-order sampling with required named targets; added browser proofs for missing, hidden, and zero-width-ancestor-clipped feedback.
2. Made uncertain spreads and mutable class bindings explicit unresolved records.
3. Shared token classification across markup, CSS, and script candidates, including variant component classes.
4. Added project-setup stories, the six-theme mounted-view matrix, supported interaction states, and the token-only SDK fixture.

The baseline and inventory JSON files are generated evidence. Do not update canonical screenshots or widen geometry tolerances to make later migrations pass. The full settings browser check still fails as documented above.

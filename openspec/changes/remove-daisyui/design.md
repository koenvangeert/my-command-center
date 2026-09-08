## Context

See `proposal.md` for motivation and `specs/semantic-ui-styling/spec.md` for the added interface contracts.

The selected theme already supplies `--of-*` tokens. `src/app.css` loads Tailwind, the daisyUI plugin, and `src/styles/theme-adapter.css`. The adapter repeats color and geometry mappings in two built-in theme declarations and a root mapping added by KVG-4671. It also contains font aliases, focus styles, compact control sizing, and reduced-motion rules. Deleting the file wholesale would remove behavior that is not specific to daisyUI.

KVG-4522 is marked done. In this checkout, `PluginFolderPackages.svelte` uses SDK controls and direct tokens. `ProjectSetupDialog.svelte` still has alerts and color utilities but no legacy button classes. Settings retains loading indicators; its forms, autosave, selectors, and provider configuration must not be migrated again.

The exploratory lexical scan found 905 color references in 113 non-test Svelte/CSS files. KVG-4671 reported 929 references across 113 files. These numbers are leads, not a removal gate: the scan did not fully parse conditional classes, directional utilities, CSS variables, or executable fixtures.

| Initial subsystem | Color references | Files |
| --- | ---: | ---: |
| Host renderer | 409 | 60 |
| Plugin SDK | 47 | 8 |
| PR review UI | 202 | 21 |
| Terminal runtime | 18 | 3 |
| GitHub sync plugin | 162 | 12 |
| File viewer plugin | 43 | 5 |
| Task browser plugin | 21 | 3 |
| Terminal plugin | 3 | 1 |

Confirmed component-style consumers include SDK `MermaidDiagramPreview` and `PluginViewState`, review alerts and loading indicators, terminal loading indicators, host project-setup alerts, attention loading states, toast presentation, and model-download progress. `select-none` is a Tailwind utility, not a daisyUI select control.

## Goals / Non-Goals

**Goals:**

- Establish one token-backed utility definition for host-built CSS and keep shared feedback behavior inside SDK modules.
- Make each subsystem migration reviewable and independently reversible while the compatibility adapter is present.
- Make removal contingent on actual consumers, packed SDK rendering, and production browser evidence rather than a regex count alone.

**Non-Goals:**

- Remove Tailwind, rename theme tokens or theme IDs, change theme registration, or redesign Studio/Workshop.
- Rewrite settings callers, terminal session ownership, lifecycle code, IPC, backend logic, or plugin contribution ownership.
- Require external plugins to adopt host utility CSS. Plugin-owned styles remain caller-owned; undocumented host daisyUI classes are not a supported interface.
- Turn historical OpenSpec documents or migration notes into zero-match targets. Documentation can describe the removed dependency.

## Decisions

### 1. Inventory executable consumers, not substrings

Extend the existing migration inventory/checker rather than introducing a competing scan. Classify Svelte attributes, class directives, conditional/template strings, script-held class values, CSS selectors and `@apply`, and references to legacy CSS variables. Inspect TypeScript/JavaScript class producers and build fixtures as well as Svelte/CSS. Use the Svelte parser for markup and structural parsing where needed for script expressions; record unresolved dynamic construction for manual review instead of treating it as zero.

Each record identifies file/subsystem, consumer kind, full class including variants and opacity, source location, replacement, and verification owner. Separate actual utility or component dependencies from ordinary local classes, comments, native element names, and Tailwind utilities such as `select-none`. Inventory directional borders, ring offsets, gradients, arbitrary variable references, geometry aliases, daisyUI global/base effects, and stylesheet entrypoints.

The final gate covers shipped sources plus executable stories, fixtures, tests, and build inputs. Historical prose and intentional negative-test strings have explicit documented exclusions. Reconcile the 929/905 discrepancy from the refreshed checkout and scan definition; do not set a target count of 905.

Alternative rejected: a global search-and-replace can miss runtime-generated classes and incorrectly migrate local class names.

### 2. Use a single inline semantic color namespace

Add `src/styles/semantic-utilities.css`, imported by `src/app.css`, with Tailwind v4 `@theme inline` mappings such as `--color-of-surface: var(--of-surface)`, `--color-of-text: var(--of-text)`, and `--color-of-accent: var(--of-accent)`. Inline mappings allow emitted declarations to resolve the active token at the consuming element. Include the semantic color roles actually needed by the inventory, including on-colors and feedback roles, without adding new theme-schema fields.

Use classes such as `bg-of-surface`, `text-of-text`, `border-of-border/50`, and `hover:bg-of-accent/10`. Preserve the entire variant chain and opacity suffix. Retain existing correct `text-[var(--of-text)]` and other direct-token utilities; converting them would repeat completed work. No unprefixed legacy aliases remain at completion.

Migration starts with paint-equivalent mappings from the current adapter:

| Legacy role | Semantic role |
| --- | --- |
| `base-100` | `surface` |
| `base-200` | `surface-subtle` |
| `base-300` | `border` |
| `base-content` | `text` |
| `primary`, `accent` | `accent` |
| `primary-content`, `accent-content` | `on-accent` |
| `secondary`, `secondary-content` | `control`, `control-text` |
| `neutral`, `neutral-content` | `text`, `text-inverse` |
| `info`, `success`, `warning` and their content roles | Corresponding semantic role and `on-*` role |
| `error`, `error-content` | `danger`, `on-danger` |

For example, `bg-base-300` initially maps to `bg-of-border`, even if a different role sounds more descriptive. Correcting an existing visual choice is not part of this migration. When an SDK module owns a covered control, use its semantic variant instead of exporting its internal utility composition to callers.

The namespace is available wherever the host stylesheet is compiled. Ensure production source discovery includes workspace packages and bundled plugins. Document that standalone plugin-owned Tailwind builds must provide their own compilation setup or use direct tokens; SDK UI exports need neither setup.

Alternatives rejected: retaining `--color-base-*` under a different file name preserves the dependency model; expanding every caller into arbitrary-value CSS makes opacity handling harder to audit. Named semantic utilities do not replace scoped SDK styling.

### 3. Put shared feedback behind small SDK interfaces

Add public `LoadingIndicator.svelte`, `Alert.svelte`, and `Progress.svelte` through the SDK's canonical export registries and asset pipeline. Reuse existing `Button`, `IconButton`, `Badge`, and other covered controls. Preserve the existing interfaces of `PluginViewState` and `MermaidDiagramPreview` while migrating their internals.

- Loading indicator: size and accessible-label/decorative configuration. A decorative indicator contributes no duplicate live region; a standalone indicator can carry a status label. Use scoped CSS with `currentColor`, semantic sizing where appropriate, and reduced-motion handling.
- Alert: semantic feedback variant, child content, native attributes, and explicit caller-owned role/live-region policy. Preserve existing `alert`, `status`, and non-live uses. Do not infer announcement urgency from an error color.
- Progress: native progress semantics, value/max, accessible naming, and semantic variant. Omitted value means indeterminate; preserve native normalization rather than adding domain-specific download logic.

Expose only sizes used by actual consumers, calibrated against existing rendered bounds. Avoid a broad styling configuration interface. Keep icons and domain text caller-owned. Publish import paths, properties, semantics, variants, and theming behavior with the existing SDK documentation and contract fixtures. Use Svelte 5 runes and `on`-prefixed callbacks where callbacks are needed.

Alternative rejected: recreating `.loading`, `.alert`, and `.progress` as global compatibility classes would leave callers dependent on undocumented host CSS and duplicate accessibility decisions.

### 4. Keep the adapter until the last consumer is gone

Keep root and built-in compatibility mappings unchanged throughout the bounded migrations. New semantic utilities use a separate namespace and must not depend on those mappings. At final removal:

- Remove the daisyUI plugin, both theme plugin blocks, dependency, and lockfile resolution after all consumer gates pass.
- Replace direct geometry aliases, including `src/app.css`'s `var(--radius-field)`, with corresponding `--of-*` tokens.
- Remove color, radius, size, border, depth/noise aliases and compact legacy-control selectors only once their consumers are absent.
- Retain and relocate font aliases, global focus treatment, and reduced-motion styles into a dependency-free global style module with the same cascade behavior. Keep existing theme application responsible for color-scheme; verify it does not rely on daisyUI defaults.
- Audit direct `--color-*` references in content CSS and theme contracts. Replace executable legacy probes with semantic probes instead of keeping aliases to make old tests pass.

Tailwind's own variables must not be mistaken for daisyUI variables. Do not ban every `--color-*` identifier; the new `--color-of-*` definitions and Tailwind's built-in palette are legitimate.

Alternative rejected: deleting dependency and aliases first hides the full range of regressions behind broadly unstyled pages and prevents meaningful per-slice comparisons.

### 5. Verify real paint, behavior, and packed outputs

Capture pre-migration browser baselines before changing shared styles. Compare computed paint and geometry after each slice under the same browser, fonts, viewport, and theme. Preserve parent/child alpha semantics with token-derived reference swatches rather than a hard-coded screenshot color. Record any necessary geometry tolerance explicitly; use a maximum one CSS-pixel measurement tolerance for unchanged bounds unless a reviewed browser rounding difference requires more.

Extend `scripts/check-settings-themes.mjs` rather than discarding KVG-4671's regression. During migration keep legacy probes and add semantic probes. At final removal replace the legacy-only probes and assertions with semantic ones while retaining stable-ID, keyboard-focus, and edited-value assertions. Use mounted views and the real theme-selection path, not only fixture-local token injection.

The browser matrix includes all four current built-ins, OpenForge Light -> OpenForge Dark -> `com.example.ink:ink`, and a second contributed theme with a different palette and geometry. Contributed IDs must not require predefined selectors. Mutate a contributed palette through the supported test setup and verify utilities track the new tokens rather than a fixture-specific palette. Retain existing unavailable-theme fallback coverage.

Representative views: SDK feedback/control fixture without Tailwind/daisyUI; project setup; attention overview; review overview and diff feedback; file viewer; terminal loading presentation; settings loading/saving feedback. Cover hover, pressed, keyboard focus-visible, selected, invalid, disabled, opacity, compact/narrow layouts, and reduced motion. Check roles, callbacks, focus and user input in behavioral tests, and computed CSS/bounds in browser tests. Screenshots supplement these assertions, not replace them.

Use the packed SDK contract and production host/plugin bundles to catch missing assets, class discovery, or CSS ordering that development fixtures conceal.

## Risks / Trade-offs

- Dynamic class generation or CSS-only consumers evade a simple scan. Mitigation: parser-backed inventory, explicit unresolved records, production rendering, and a zero-unresolved final gate.
- `text-of-*` or gradient utilities compile differently than assumed. Mitigation: an initial compiled-CSS/browser probe for every used utility family, variant chain, and opacity form before bulk caller migration.
- SDK defaults alter spacing, alert announcements, or loading dimensions. Mitigation: capture baseline bounds and semantics, test the public feedback interfaces first, then migrate callers in small groups.
- Removing the adapter drops unrelated focus, motion, fonts, or color-scheme behavior. Mitigation: retain those rules explicitly and run browser regressions with the entire adapter absent.
- Contributed theme fixtures accidentally pass because they use built-in selectors or palette values. Mitigation: namespaced IDs, deliberately different tokens, runtime switching, and palette mutation checks.
- A plugin relied on undocumented host daisyUI classes. Mitigation: document the removed host dependency and supported SDK/direct-token path; do not change plugin-owned styles or documented exports.
- A broad migration drifts into settings or terminal logic. Mitigation: presentation-only file diffs, KVG-4522 exclusions in the inventory, and no session/lifecycle changes.

## Migration Plan

1. Refresh inventory, confirm KVG-4522/KVG-4671 state, record current browser evidence and validation commands.
2. Add and validate semantic utilities and SDK feedback modules while keeping compatibility CSS.
3. Migrate existing SDK consumers, then PR review UI and terminal runtime presentation as separate slices.
4. Migrate GitHub sync, file viewer, task browser, and terminal plugins separately, validating each package.
5. Migrate host project setup/attention, task/review views, then remaining shell/feedback/content consumers. Limit settings edits to leftover dependencies.
6. Reach zero executable legacy consumers, update compatibility-specific fixtures, and remove daisyUI and obsolete mappings in one final slice.
7. Run full affected-system validation and production/browser checks after removal, and record exclusions and any remaining coverage gaps.

Each migration slice can be reverted while the adapter remains. If the final removal regresses presentation, revert the removal slice first, restoring the dependency and mappings without undoing already-migrated callers. No data migration or preference rewrite is required.

### Validation commands and scope

Re-read `CONTRIBUTING.md#testing` and current package scripts at implementation time. The complete planned diff affects shared styling, SDK publication, dependencies, and several frontend subsystems, so final validation is broader than individual leaf migrations.

- Host: `pnpm test`, `pnpm lint`, `pnpm build`, and `node scripts/check-settings-themes.mjs`. Root `pnpm test` includes first-level workspace suites; disclose skipped browser suites or missing Storybook services rather than counting them as passed.
- SDK: `pnpm --filter @openforge-app/plugin-sdk test`, `build`, `check:entrypoints`, and `check:contract`.
- Review UI: `pnpm exec vitest run packages/pr-review-ui` and `pnpm --filter @openforge-app/pr-review-ui check`.
- Terminal runtime: `pnpm --filter @openforge-app/terminal-runtime test`, `build`, and `conformance` because the shared terminal presentation is exercised in the runtime consumer.
- Each affected plugin: its `test` and `build` scripts; GitHub sync and task browser also provide `typecheck`. File viewer and terminal have no separate typecheck script in this checkout, so report that limitation rather than invent a command.
- Cross-package: `pnpm build:plugins`, the SDK publication contract, the migration inventory gate, and the browser matrix described above against development and production assets.
- Install the matching Chromium with `pnpm exec playwright install --with-deps chromium` if needed. Use the repository visual-review workflow for screenshots; do not accept missing browser dependencies as a successful browser check.

Rust, mobile, and website validation is not planned unless the actual implementation expands into those subsystems. No runtime checks have been performed as part of this planning-only change.

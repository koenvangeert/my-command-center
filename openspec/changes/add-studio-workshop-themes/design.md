## Context

See `proposal.md` for motivation and `specs/studio-workshop-themes/spec.md` for observable requirements.

`src/lib/themeContract.ts` currently exports two frozen built-in definitions with complete semantic tokens. `createThemeRegistry` installs `BUILTIN_THEMES`; the settings controller consumes the registry's available themes and selects by identifier. `src/lib/theme.ts` owns persistence and legacy preference migration through existing typed IPC wrappers. Document and content adapters already receive theme tokens and explicit appearance.

The registry and token foundation comes from `add-angular-extensible-theming`, whose planning artifacts remain unarchived. Build on the implementation in this branch, not on completion or archive of that separate change. Do not alter its artifacts. The new capability has its own flat spec directory because `application-theming` is not yet a main spec.

Storybook's shared theme toolbar and the screenshot manifest validator currently enumerate only `openforge-light` and `openforge-dark`. The visual-review guide requires pinned Linux captures, not native screenshots, for approved baselines.

Reference inspected during exploration: official light-mode demo stills linked from https://developers.openai.com/codex/app/, especially https://developers.openai.com/images/codex/video-posters/proactive-teammate-v2.webp. They show a white canvas, dark text, pale gray controls, a rounded composer, thin borders, and small shadows. These are visual references, not a source for exact color measurements, app layout, logos, or imported assets.

## Goals / Non-Goals

**Goals:**
- Express two styles through the current theme interface rather than introduce separate rendering paths.
- Keep palette maintenance local to each style while registering every variant through the same built-in catalog.
- Validate appearance in real host and shared plugin UI, not just palette swatches.
- Keep selection, persistence, content rendering, and active-session ownership unchanged.

**Non-Goals:**
- No theme-family persistence model, separate appearance preference, system-following mode, theme editor, or new picker design.
- No change to default identifiers or existing OpenForge names. Their palettes are intentionally replaced with Studio designs.
- No layout, density, navigation, or terminal lifecycle redesign.
- No public SDK token additions, plugin theme API changes, or blanket overrides of custom plugin CSS.
- No Glass work, native transparency, backdrop blur, new fonts, remote assets, or dependency changes.

## Decisions

### 1. Four built-in choices with stable OpenForge identities

Use these stable identifiers and labels:

| Identifier | Label | Appearance |
|---|---|---|
| `openforge-light` | OpenForge Light | light |
| `openforge-dark` | OpenForge Dark | dark |
| `workshop-light` | Workshop Light | light |
| `workshop-dark` | Workshop Dark | dark |

Register exactly these four definitions in paired light/dark order. Studio is the design of OpenForge, not an additional selectable family. Preserve `openforge-light`, `openforge-dark`, existing labels, the fallback constant, and stored legacy mappings. The current settings picker can expose the additional definitions without a new preference or migration.

Alternative: a style selector plus light/dark/system selector. Rejected for this change because it adds preference and synchronization behavior that the user did not request. Explicit variants fit the existing interface and preserve compatibility.

### 2. Keep definitions separate from registry behavior

Add renderer-local Studio and Workshop definition modules under `src/lib/themes/`, each exporting two complete, validated, frozen `ThemeDefinition` values. Keep their public interface limited to those definitions. Have `themeContract.ts` import them for `BUILTIN_THEMES` while preserving existing exports. New definition modules can import types and validation helpers directly from the SDK to avoid a cycle through the catalog.

Compose complete token sets from style-local metrics and explicit light/dark palettes. Share geometry, typography, and motion within a style. Do not copy registry operations or grow a configurable theme factory. Remove the superseded OpenForge palettes and preserve LIGHT_THEME/DARK_THEME exports as aliases of the Studio-designed definitions. Keep normal control heights, spacing, and text-size metrics consistent with the current application; visual distinction comes from corners, surfaces, elevation, and technical-label treatment.

Alternative: append four large palettes to `themeContract.ts` or override an arbitrary existing theme at runtime. Separate definitions avoid growing the catalog into a large palette file and make light/dark completeness review straightforward without runtime inheritance rules.

### 3. Studio uses neutral contrast and soft geometry

Design starting points, subject to measured contrast and screenshot review:

| Token role | Studio Light | Studio Dark |
|---|---|---|
| Canvas | white, approximately `#FFFFFF` | neutral charcoal, approximately `#181818` |
| Secondary surface | pale gray, approximately `#F5F5F5` | lifted gray, approximately `#222222` |
| Primary text | near-black, approximately `#202020` | near-white, approximately `#F2F2F2` |
| Primary action | near-black with white text | near-white with dark text |
| Geometry | roughly 8px controls, 12px panels, 16px overlays | same geometry |
| Elevation | small surface shadows, restrained overlay shadow | mostly surface contrast, restrained overlay shadow |

Use the bundled Inter font for normal UI and the existing code font path for technical content. Keep blue or another contrast-checked functional color for links and focus where useful; near-monochrome actions do not imply grayscale errors or diffs. Give warning, success, danger, and info their own semantic values.

Alternative: imitate the entire Codex layout or use oversized rounded cards everywhere. Rejected because OpenForge's dense work views must retain their layout and information density. The inspiration is material and hierarchy, not a clone.

### 4. Workshop uses warm contrast and crisp geometry

Design starting points, also subject to measured contrast and screenshot review:

| Token role | Workshop Light | Workshop Dark |
|---|---|---|
| Canvas | warm paper, approximately `#F5F2EB` | graphite, approximately `#1B1C1B` |
| Raised surface | warm off-white, approximately `#FFFDF7` | warm dark gray, approximately `#262724` |
| Primary text | dark ink, approximately `#282720` | warm light text, approximately `#EEEADF` |
| Primary action | deep amber, approximately `#8A4B08`, with light text | amber, approximately `#E5AC4F`, with dark text |
| Geometry | roughly 2px controls and panels, 4px overlays | same geometry |
| Elevation | borders and surface contrast; shadows reserved for overlays | same treatment |

Use Inter for body content and the bundled JetBrains Mono through the existing mono token for technical metadata. Do not switch all labels or paragraphs to monospace, shrink text, or override the user's terminal-font preference. Existing technical-label hooks should consume the mono token; any necessary adjustment must be local to the affected theme-aware building block and verified under the existing themes too.

Amber is an action color, not a replacement for all status colors. Warnings require text or icon cues and a distinct background treatment; success and danger retain their semantic colors. Separate panel boundaries from focus and interactive boundaries so decorative borders need not become excessively heavy.

Alternative: neon green, pixel fonts, CRT effects, and dense retro chrome. Rejected because the workbench direction should remain comfortable for long sessions and distinct from a novelty terminal theme.

### 5. Apply tokens through existing adapters

All four definitions must cover the full existing token contract: controls, fields, focus, text, status, code, diff, terminal ANSI colors, selection, cursor, geometry, fonts, shadows, and motion. Light and dark palettes are authored independently; do not invert colors or infer appearance from identifiers.

The existing document adapter is the seam for mounted UI. Theme-sensitive content continues using existing presentation adapters. Do not remount task views, restart terminals, or release prop-keyed resources to refresh colors. Custom plugin styles remain an explicit escape hatch.

Studio and Workshop use opaque content surfaces. Existing scrims, selections, and subtle shadows may retain alpha values; the exclusion is glass-like translucent panels and backdrop effects, not ordinary overlay dimming.

Alternative: global theme-name selectors with deep descendant overrides. Rejected because they couple each style to host and plugin markup. If a necessary shared control ignores a relevant existing token, adjust that control narrowly rather than introduce a style-specific global override. Log unrelated cleanup separately.

### 6. Behavioral tests and visual evidence serve different purposes

Use existing public seams for behavior:
- Theme validation and built-in catalog for distinct IDs, complete tokens, immutability, and explicit appearance.
- Registry and runtime selection for availability, persistence, restoration, legacy mapping, and fallback.
- Document and content adapters for applying tokens and correct light/dark presentation.
- Settings interaction for all four labels and the active selection.
- A mounted-view regression or existing session test seam for preserving active view, input, and terminal identity on theme changes.

Use TDD for added product behavior and visual-runner validation. Do not write unit tests that freeze every hex value or CSS string. Use computed contrast checks for semantic foreground/background pairs and browser checks for keyboard, focus, interaction states, and reduced motion. Verify styled content visually with representative data, including positive/negative diffs and terminal ANSI output.

Extend the shared Storybook toolbar and all theme-ID constraints along the existing capture path to accept the four explicit IDs. Keep unknown identifiers rejected, existing capture determinism intact, and legacy baselines selected. Do not generalize the runner to arbitrary plugin themes or redesign its architecture.

Capture the populated Focus Board and a shared-control showcase for each new variant. Include a representative task detail/content view with Markdown, diff, and terminal presentation, plus a menu or dialog state for overlay geometry. Reuse existing stories where possible. Use a standard desktop viewport and check a supported narrow desktop viewport for clipping and overflow. Retain existing OpenForge capture identities and regenerate their baselines for the owner-requested redesign. Remove provisional Studio-ID captures and retain any additional story coverage under OpenForge IDs.

### Authorized terminal-fixture prerequisite

Implementation exposed missing parser continuation in local terminal and Task Detail Storybook replay snapshots. The failure also occurs under OpenForge Light. The owner authorized fixing these fixtures in this change and deleted the separate follow-up task. Their complete ANSI transcripts have no pending parser bytes, so provide an explicit empty continuation in each transport's representation. Keep the runtime's rejection of missing continuation intact. Add regressions at the replay fixture interfaces and verify real terminal readiness in the existing canonical browser capture path.

### 7. Validation scope follows the shared theming impact

For implementation, run focused theme/settings tests during development, then full renderer checks because built-in presentation reaches the whole app. Run full visual-tool checks because its accepted identifiers and capture coverage change. Applicable commands from `CONTRIBUTING.md` and the visual-review guide include:

- `pnpm test` and `pnpm exec tsc --noEmit`.
- `pnpm storybook:build`, `pnpm storybook:coverage`, and `pnpm storybook:coverage:check` for the updated catalogs.
- `pnpm storybook:visual:unit`, `pnpm storybook:visual:update`, review the generated image diff, then `pnpm storybook:visual:check` and `pnpm storybook:visual:test`, sequentially in the pinned Linux container.
- `pnpm packages:contract:check` for shared UI contract compatibility.
- If SDK source changes are necessary, also run `pnpm --filter @openforge-app/plugin-sdk test` and `pnpm --filter @openforge-app/plugin-sdk check:entrypoints`, plus its contract check. Inventory any additional subsystem touched and run its full test/static scripts.

Ensure Chromium is installed for browser checks. Docker is required for canonical screenshot checks. Document missing prerequisites and any skipped browser checks instead of treating skipped tests as proof. Rust, website, mobile, and native-window validation are unnecessary if those systems remain untouched.

Planning-only verification consists of strict OpenSpec validation and a diff check; it does not require running product tests.

## Risks / Trade-offs

- [Amber actions could look like warnings] -> Keep distinct status backgrounds, icons or labels, and review warning/error states alongside ordinary actions.
- [Soft Studio borders could lose contrast] -> Measure text, interactive boundaries, and focus separately; retain subtle decoration only where it conveys no essential state.
- [Theme consumers may ignore geometry or content tokens] -> Audit representative mounted host and SDK UI, fix only required integration gaps, and review the intentional OpenForge screenshot changes.
- [More variants increase maintenance] -> Keep palettes local to each style, use one token contract, and validate all built-ins together.
- [Screenshot support has more than one theme-ID constraint] -> Trace toolbar, story environment, validator, and capture color-scheme handling; add regression coverage before extending each affected constraint.
- [Rollback to an older app cannot recognize new IDs] -> Rely on its existing unavailable-theme fallback and disclose that a downgrade can replace the saved selection with OpenForge Light.

## Migration Plan

1. Replace OpenForge palettes with Studio and add Workshop without changing storage format, default identifiers, or legacy migration.
2. Expose them through the existing settings preference and update theme-aware presentation only where the current contract requires it.
3. Add behavioral coverage and approved visual baselines; verify existing identifiers and contributed themes remain unchanged.
4. Ship the redesigned OpenForge built-ins to current users and new installations automatically, preserving their selected light/dark appearance. Workshop is additional.
5. If reverting the addition, remove the new definitions and their visual cases together. An unavailable stored ID follows the established fallback path; no database migration or session teardown is required.

## Owner revision after rebase

The owner explicitly requested replacing OpenForge Light/Dark with Studio Light/Dark respectively, retaining OpenForge labels and IDs and removing separate Studio choices. This supersedes the original additive-Studio plan. Main at `da9c34e5` already contains the local terminal continuation fix; retain it and the additional Task Detail readiness coverage. Measured per-case visual allowances up to 32 pixels and two channel levels are authorized only if still needed after rechecking. Existing unrelated tolerances must not be widened.

The owner subsequently approved the measured Workshop Dark Review allowance of 36 pixels. The validator ceilings are now 36 pixels and two channel levels. The measured OpenForge Light Markdown border uses two levels; other allowances use one. Only measured individual case allowances are changed.

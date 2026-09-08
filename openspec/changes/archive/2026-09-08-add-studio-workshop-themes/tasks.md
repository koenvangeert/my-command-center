## Scope and final evidence

The owner revised the original additive-Studio plan: OpenForge Light/Dark use Studio Light/Dark designs respectively, retaining OpenForge names and IDs. Workshop Light/Dark are additional choices. Separate Studio IDs are not registered. This revision supersedes the earlier requirement to preserve the old OpenForge appearance.

Rebased onto origin/main at `da9c34e565088e267608617ae02c18f923ce82d5`. Main already includes the local terminal replay continuation fix. The additional Task Detail continuation and painted-output readiness checks remain part of this change. KVG-4820 was deleted at the owner's request. The pre-rebase stash `2c5580af91f924bab7b80a3539acc0ecc7b692c5` remains a backup.

Validation: full `pnpm test` passes 6,235 tests across 736 files; 19 tests across three files are skipped. `pnpm exec tsc --noEmit`, `pnpm packages:contract:check`, `pnpm storybook:visual:unit` (26 tests), Storybook coverage/static checks, and strict OpenSpec validation pass. Both catalogs build in the canonical Linux commands. `pnpm storybook:visual:check` exits zero with 99 passing cases. `pnpm storybook:visual:test` exits zero after repeated captures, deliberate pixel regression, update evidence, diagnostic/readiness checks, invalid-baseline probes, and restoration. An earlier wrapper timeout and transient npm DNS error were resolved by retrying with a sufficient timeout, not by skipping checks.

All 99 selected canonical images were visually reviewed, including host chrome, narrow views, controls, overlays, Markdown, diffs, terminal output, and intentional error states. OpenForge now has neutral surfaces and rounded geometry; Workshop retains warm surfaces, amber actions, and crisp geometry. Existing layouts and custom presentation remain unchanged. Measured case-specific antialiasing allowances have reasons and remain within the owner-approved ceilings of 36 pixels and two channel levels. Exact comparison remains the default. Generated logs and review sheets are not deliverables.

Skipped suites are `FocusBoard.browser.test.ts` (requires a live Storybook URL), `InteractionOverlays.visual.test.ts`, and `RichMarkdownDiff.visual.test.ts` (opt-in visual suites). Their gated tests are not counted as exercised. Canonical Storybook captures and mounted-control browser tests provide the task's visual and interaction coverage. SDK production source, Rust, website, mobile, and native-window systems are unchanged and excluded from additional subsystem validation.

One fresh-context review against the rebased main commit approved the code with no blocking findings. Its P3 finding about stale tolerance documentation is resolved. Review run: `7cbc509b-b689-4ac3-b354-76e4324dd09b`.

## 1. Confirm behavior seams and implement Studio-designed OpenForge

- [x] 1.1 Confirm catalog validation, registry/runtime, settings, document/content adapters, and mounted Task Detail as the existing public test seams; no new preference, SDK token, or lifecycle interface.
- [x] 1.2 Add failing catalog regressions for complete, immutable light/dark definitions and the four-choice catalog, retaining `openforge-light` / `openforge-dark` and their labels.
- [x] 1.3 Implement style-local Studio definitions and expose them through existing OpenForge exports; verify neutral palettes and rounded geometry in mounted controls.

## 2. Add Workshop

- [x] 2.1 Add failing availability and completeness tests for stable `workshop-light` / `workshop-dark` identifiers and explicit appearance.
- [x] 2.2 Implement both Workshop palettes with warm paper/graphite surfaces, amber actions, crisp geometry, and existing technical typography.

## 3. Verify selection and presentation compatibility

- [x] 3.1 Verify all four picker labels, selection, live application, persistence, and exact restoration through existing runtime/settings seams.
- [x] 3.2 Preserve existing identifiers, legacy light/dark routing, default/fallback identifier, and contributed themes; verify existing OpenForge selections adopt Studio without migration.
- [x] 3.3 Verify document, Markdown/diagram, diff, and terminal adapters use declared appearance and applicable tokens while preserving terminal-font preferences.
- [x] 3.4 Verify theme changes preserve the mounted task pane, unsent input, and terminal identity.
- [x] 3.5 Review representative host controls and shared plugin building blocks; existing tokens express the planned styles without shared-control changes or blanket custom-style overrides.

## 4. Add theme-aware visual coverage

- [x] 4.1 Add failing tests for new capture identifiers and explicit appearance; reject unknown identifiers.
- [x] 4.2 Derive toolbar choices from the catalog and accept exactly four built-in IDs through the capture path; verify both catalogs and browser application.
- [x] 4.3 Cover populated boards, narrow shells, controls, menus/dialogs, technical labels, Markdown, diffs, and real terminals for all variants; verify readiness and no new clipping. Coverage reports 43 covered, 205 uncovered, and zero errors under incremental adoption.
- [x] 4.4 Verify computed contrast for text, semantic content, interactive boundaries, focus, and terminal colors; warnings retain labels/icons beside amber actions.
- [x] 4.5 Verify keyboard focus, hover/pressed/selected/invalid/disabled states, and reduced motion using mounted-control browser tests and representative stories; no Glass, layout redesign, or terminal-font override.
- [x] 4.6 Retain existing capture identities, replace their OpenForge appearance intentionally, remove provisional Studio identities, review all 99 canonical images, and pass canonical update/check/self-test.
- [x] 4.7 Document the four choices, stable OpenForge identities and defaults, accepted capture IDs, measured allowances, and deferred Glass work.
- [x] 4.8 Verify failing replay regressions become green with explicit empty continuation; retain the upstream local transport repair without weakening runtime validation.
- [x] 4.9 Require real painted terminal output for Task Detail readiness and verify terminal captures under OpenForge and Workshop.

## 5. Validate and hand off

- [x] 5.1 Run full renderer tests, TypeScript, and package contract checks; disclose gated/skipped browser tests.
- [x] 5.2 Build both Storybook catalogs and run coverage/static checks, visual unit tests, and sequential pinned Linux update/check/self-test commands.
- [x] 5.3 Inventory the full diff and validate affected renderer/visual-tool subsystems; record unchanged subsystems as excluded.
- [x] 5.4 Complete the single formal review, resolve its finding, replace task-scoped Handoff Notes successfully, and ensure the final diff contains only agreed implementation and canonical baselines.

## 6. Apply the owner's OpenForge replacement revision

- [x] 6.1 Replace OpenForge palettes with Studio under stable names/IDs, remove duplicate Studio choices, and verify selection, persistence, legacy fallback, and content tests.
- [x] 6.2 Reconcile toolbar, capture identities, documentation, and intentional OpenForge baseline changes with the four-choice catalog.
- [x] 6.3 Recheck after rebase and add only measured allowances within the approved 36-pixel/two-level ceilings; complete validation and formal review.

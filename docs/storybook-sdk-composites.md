# SDK composite catalog

KVG-4692 covers the exported Modal, AnchoredMenu, Tooltip, Tabs, MarkdownContent, ProjectFileTree, ResizablePanel, PluginPageShell, PluginPageHeader, PluginViewState, CollapsibleSection, and PluginSidebarLink components. KVG-4691 owns buttons, inputs, selectors, badges, panels, and basic file icons. Those controls appear in these compositions but are not claimed by this inventory slice.

The component catalog groups these stories under `SDK`. The page catalog has `Pages/SDK page shell`, using the shared production host frame. Fixtures supply props and local interaction state, not copies of production markup. The shared preview supplies production CSS, fonts, themes, storage isolation, and deterministic time. Section stories additionally reset the SDK's shared collapse store and restore its previous value at teardown.

## Verification

```sh
pnpm storybook:build
node scripts/storybook-sdk-check.mjs
pnpm exec vitest run storybook
pnpm exec tsc --noEmit -p storybook/tsconfig.json
pnpm storybook:coverage
pnpm storybook:visual:check
```

The SDK browser check runs every story in this slice, then remounts it in the same document. It fails on unsuccessful play functions or unexpected browser diagnostics. It also drags a real resize handle, restores the default width, and verifies a persisted width does not leak into the next render. No network hosts beyond the local static catalog are allowed.

Interaction stories cover modal initial focus, saving and reopening, Escape dismissal and disabled closing, menu disabled-item skipping and checkbox selection, automatic and manual tabs, tooltip focus and dismissal, markdown link callbacks, tree navigation, keyboard resizing, retry, first-report creation, and section collapse. Production component tests provide additional public-boundary coverage.

The visual manifest selects design-significant layouts across light/dark themes and constrained viewports. It avoids duplicating every state in every theme. Baselines must be generated with `pnpm storybook:visual:update` in the pinned Linux container, never from native browser screenshots. See [visual review](storybook-visuals.md).

The capture environment freezes animated SVG masks at their declared terminal values. This derives a static frame from the production SVG, including the loading spinner, without replacing it with a fixture icon. CSS reduced motion alone does not stop SVG mask animations.

The unrelated drag-unmount resource cleanup belongs to KVG-4764. This slice leaves SDK production behavior unchanged.
KVG-4808 tracks a rapid menu-reopen autofocus race found during repeated browser checks. The keyboard story waits for the opening paint to settle before testing End/Enter navigation; it does not claim coverage of that race.

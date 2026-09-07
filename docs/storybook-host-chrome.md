# Host chrome and feedback stories

KVG-4703 extends the `add-ui-storybooks` foundation. Browse `Application/Shell` in the page catalog, or `Components/Host Chrome`, `Components/Host Controls`, and `Components/Feedback` in the component catalog.

The page fixture mounts the shared `PageFrame`, which uses production `ApplicationShell`, `AppSidebar`, and `IconRail`. Project headers, Focus Board content, shortcut help, quit confirmation, and notifications are production components. The fixture supplies local data and callbacks. It never mounts `App.svelte`, starts an agent, closes a desktop window, or copies shell markup.

## Ownership

This slice adopts the host sidebar and Project list, Project tools and their static navigation icons, Project header, application shortcut/quit dialogs, ToastHost and AppToast, host context menus, the host bottom panel, and the host markdown adapter. See `storybook/coverage-inventory.mjs` for exact source and story assignments.

Sibling tickets retain:

- KVG-4691 and KVG-4692: exported SDK controls, banners, feedback components, and composites. Rendering them inside a host fixture does not claim their inventory entries.
- KVG-4693: Project/global settings destinations and their settings modules, including model-download settings.
- KVG-4694: creation/setup dialogs and prompt controls, including voice input.
- KVG-4695: Project switcher, palettes, quick-open, and palette input/list/footer controls.
- KVG-4696 and the parent: board/attention content. The shell uses the existing Focus Board as context, without taking over its state catalog.
- Domain tickets: task, review, integration and plugin feedback. No unrelated module is excluded to silence discovery.

## Checks

```sh
pnpm storybook:build
node scripts/storybook-chrome/check.mjs
pnpm exec vitest run storybook/shared
pnpm exec tsc -p storybook/tsconfig.json --noEmit
pnpm storybook:coverage
pnpm storybook:coverage:check
pnpm storybook:visual:check
```

The browser check uses the built catalogs. It waits for Storybook's completion event, runs each selected story again in the same document, and fails on failed play functions, browser errors, or console warnings/errors. It checks repeat open/close, selection, disabled actions, transient notification dismissal, resizing and layout-storage reset. It also changes the shell's selected Project, collapse state and open dialog before rerendering, then checks that they reset. A story ID fragment can be passed to run a focused check.

The desktop adapter's `defer(command)` lets a play function pause a save after theme and environment setup. Always release the command in `finally`. Deferring every `set_config` call during installation would also block the theme adapter.

## Screenshot selection

The manifest adds shell baselines for expanded, collapsed, zen, global, narrow, dialogs and notifications, plus isolated context menus, long notifications, development chrome and the bottom panel. Both production themes are represented. The narrow application case uses the shared 900-pixel desktop viewport; isolated controls also use 320- and 480-pixel canvases. This is not a mobile application catalog.

Use the pinned Linux container from [the visual guide](storybook-visuals.md) to update and compare baselines. Selected shell cases record measured one-channel antialiasing allowances for the underlying Task state badge, between nine and 16 pixels. The manifest records each measurement. Other new cases use exact comparison. Do not widen allowances to accept a design change.

The default coverage command remains incremental. Complete repository adoption and enforcement belong to KVG-4704.

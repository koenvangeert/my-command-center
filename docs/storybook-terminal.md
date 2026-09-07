# Terminal catalog

The Terminal stories mount the production plugin views and shared Terminal Runtime components. Page stories use `PageFrame` or `TaskPaneFrame`. The catalog does not mount the application root.

## Run the checks

```sh
pnpm storybook:build
pnpm storybook:terminal:check
pnpm storybook:coverage
pnpm exec tsc -p storybook/tsconfig.json --noEmit
pnpm exec vitest run storybook
pnpm storybook:visual:check
```

`storybook:terminal:check` runs every Terminal story twice in the same document, including play functions. It checks input and shell tabs, copies selected replay text through the clipboard, rejects external requests and unexpected diagnostics, and checks disposal and persisted layout isolation. It requires the Playwright Chromium installed for the locked workspace version.

Use `pnpm storybook:visual:update` for intentional baseline changes. Both visual commands use the repository's pinned Linux container. Review the generated before/current/difference report, not just the new PNGs.

## Local responses

`storybook/shared/environment/storyTerminalTransport.ts` implements the public Terminal transport contract with ANSI replay snapshots, instance IDs, sequence watermarks, local input echo, exit events, and connection-restored events. It does not import desktop IPC or execute commands. Each tab gets a separate indexed shell identity. Disabled output subscriptions keep data in the next replay instead of receiving live events.

`storyTerminalAdapter.ts` connects that transport to the production runtime and owner-scoped session service. The plugin API uses local spawn and kill responses. Workspace lookup has ready, missing, controlled loading, and error states. Theme and font stores are the production stores managed by the shared story environment.

Storybook disposes the environment before it removes the old story tree. `StoryTerminalFrame.svelte` therefore hides and unmounts Terminal views before the adapter disposes their runtime. This preserves the plugin's current runtime binding during component cleanup. Disposal rejects retained runtime sessions or transport listeners. The next story receives a new adapter and fresh local state.

The public environment reset unmounts those views, creates a fresh runtime, then remounts them through stable adapter props. The Reset story exercises this with a mounted production terminal. Populated screenshots wait for replay text through runtime presentation diagnostics and a presentation drain. Local replay requests a steady ANSI cursor, and readiness establishes focus before capture.

## Ownership

This slice owns `plugins/terminal` visual contributions and visible components in `packages/terminal-runtime`. Host Agent-terminal wrappers in `src/components/task-detail` remain with their catalog owners. `TerminalTabsShell` is exercised through both the plugin tabs and shared tabs surface; `TerminalTabsTaskTerminal` is exercised by the shared surface's default composition. The runtime-unavailable story uses the production plugin error boundary without claiming ownership of that shared host component.

Canonical cases cover light and dark themes, a full page, a narrow Task pane, shell-tab overflow, empty output, disconnected shells, workspace failures, and unavailable runtime presentation. They deliberately do not cover every state/theme/viewport combination.

Loading remains covered by the interaction runner, but has no canonical PNG yet. DaisyUI's spinner uses an animated SVG mask that the shared runner's CSS animation controls do not freeze. KVG-4775 tracks deterministic mask capture and the loading baseline. No image tolerance was widened to hide this animation.

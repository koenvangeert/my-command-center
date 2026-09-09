# Task Schedules catalog

KVG-4701 owns the Task Schedules rail contribution and its workspace, list, composer, inspector, and confirmation dialogs. History and run status are part of the production inspector, not separate source components. Task Browser, GitHub Sync, demo plugins, and generic SDK controls remain with their sibling tickets.

## Scenarios

The Pages catalog uses `TaskSchedulesView` inside the shared production shell frame. The Components catalog mounts the production list, composer, inspector, workspace, or dialogs with the production schedule controller. Neither catalog activates the production application or scheduler.

- Pages cover one-off schedules and daily, weekly, monthly, and custom recurrence; create, edit, pause, enable, delete, discard, filtering, sorting, retry, and history navigation.
- The list includes active, paused, completed, and cancelled schedules, both execution modes, and all recent-run results.
- Composer stories cover existing and new schedules, required fields, invalid cron, past dates, saving, long prompts, and narrow widths.
- Inspector stories cover empty and populated history, completed and cancelled schedules, updates in progress, simulated success, warning, failure, and cancellation.
- Deferred responses keep loading, saving, deleting, running, and cancelling states inspectable. They do not rely on a wall-clock delay.

## Local backend and reset

`scheduleScenario.ts` supplies fixed records at `2026-01-02T09:30:00Z`. The shared plugin adapter registers `storyScheduleBackend.ts` methods in the SDK testing registry. Production IPC wrappers call those methods. Draft validation uses the production parser and normalizer.

The local backend has no Tasks API and starts no background service. Run-now actions only append simulated outcomes with `CATALOG-` Task references. The fake navigation API records clicks on those references. Every story interaction asserts that no Task creation or implementation-start call occurred.

Each story render receives a fresh backend and fixed clock through the shared environment. Backend disposal rejects held requests before the next environment is installed. Local and session storage reset with the environment, including the production `resizable-panel:task-schedules-inspector` and `resizable-panel:task-schedules-form` keys. Interactions wait for production modal teardown to release its pointer lock instead of disabling pointer checks.

## Validation

Run from the repository root:

```sh
pnpm exec vitest run storybook/shared/environment/storyScheduleBackend.test.ts storybook/shared/frames/TaskSchedulesPage.test.ts
pnpm --filter @openforge-app/plugin-task-schedules test
pnpm exec vitest run --project renderer
pnpm exec tsc --noEmit
pnpm exec tsc -p storybook/tsconfig.json --noEmit
pnpm lint
pnpm storybook:build
RUN_STORYBOOK_SCHEDULES=1 pnpm exec vitest run storybook/taskSchedules.browser.test.ts
pnpm storybook:coverage
pnpm storybook:coverage:test
pnpm storybook:coverage:check
pnpm storybook:visual:unit
pnpm storybook:visual:update
pnpm storybook:visual:check
```

The explicit browser suite runs every schedule story twice in the same document. It checks fixed time, saved panel-width reset, absence of external requests and unexpected diagnostics, and release of the production view's 30-second refresh interval. The IPC and rendered-page tests separately assert mutation isolation and teardown.

The visual manifest selects design-significant page and component states across all four built-in themes, desktop layouts, and narrow widths. Schedule cases use exact comparison. The readiness marker is written only after the story's interaction and safety assertions pass. Use the pinned Linux commands in the [visual review guide](storybook-visuals.md), not native screenshots, to approve baselines.

Coverage remains incrementally adopted repository-wide. Uncovered sibling modules are not exclusions and are not claimed by this ticket. Task-specific verification results and remaining gaps are recorded in KVG-4701 Handoff Notes.

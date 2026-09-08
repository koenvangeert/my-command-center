## 1. Immediate post-save handoff

- [x] 1.1 Add failing workflow and app-controller regressions for successful persistence with unresolved startup and task-list refresh; verify the tests require immediate dismissal, saved-task presentation, one navigation, and no second creation.
- [x] 1.2 Implement an intent-aware saved-task handoff between the creation workflow, app controller, and shell wiring; publish the saved detail before routing and move refresh off the handoff path. Verify the deferred-start and deferred/failed-refresh tests pass.
- [x] 1.3 Remove the saved-task retry screen and dialog-owned post-save startup retry phases without changing edit-task behavior. Verify component tests show no intermediate saved screen, preserve failed-save drafts and attachments, and guard repeated submissions while persistence is pending.

## 2. Backlog and compose behavior

- [x] 2.1 Add failing tests for Save to backlog from the board and another selected page, then ensure completion only publishes the saved task and dismisses. Verify no start, reset-to-board, navigation, selection change, or filter reset occurs.
- [x] 2.2 Add failing compose handoff tests, then adapt result settlement and request-scoped dismissal to the new completion path. Verify both intents deliver exactly one saved result before close, preserve the existing start-indicator meaning, and do not cancel a newer compose request when old follow-up work finishes.

## 3. Task-owned startup feedback and retry

- [x] 3.1 Add failing session-action and task-page tests for startup pending, rejection after dialog destruction, and canceled workspace preflight. Implement app/session-owned task-keyed feedback using existing pending state; verify errors remain visible on the saved task and no promise rejection is left unhandled.
- [x] 3.2 Wire retry on the task page through the existing guarded start action and clear obsolete task-keyed error state on a new attempt and success. Verify retry uses the same task ID, creates no task, and cannot duplicate a pending or active session.
- [x] 3.3 Preserve successful-start classification when subsequent refresh or terminal presentation fails. Verify regression tests do not offer a failed-start retry or trigger another start in these cases, and that dialog teardown does not release startup-owned resources.

## 4. Integration validation

- [x] 4.1 Run the focused creation workflow, app-controller, compose, dialog, task-page, and session-action regressions. Verify all delta-spec scenarios are covered, including failed persistence and delayed/failed refresh, and record any uncovered scenario.
- [x] 4.2 Run full renderer subsystem validation with `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm lint`. Verify passing results or document exact failures and skipped environment-dependent suites; add full affected-package and contract checks if the final diff extends beyond the renderer.
- [x] 4.3 Smoke-test Create & Start with slow and failed startup, retry on the saved task, and Save to backlog from both the board and another task/page in the desktop app. Verify there is no intermediate saved dialog, no duplicate task, and no backlog navigation; record results and any environment blocker.

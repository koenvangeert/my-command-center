## Context

See proposal.md for motivation and specs/task-creation-handoff/spec.md for the behavior contract. This design is needed because dismissal changes asynchronous ownership across several renderer modules.

`taskCreationWorkflow.svelte.ts` stores a saved creation and awaits notification, startup, and close in sequence. `AddTaskDialog.svelte` switches to the saved-task message whenever that saved record exists, even without an error. `appTaskCreationController.svelte.ts` refreshes tasks before navigation, then awaits the start action. This keeps the dialog alive during slow startup and makes it the recovery owner.

`App.svelte` can render a selected task from `taskDetailsById`, the active list, or `pendingTask`. The saved `TaskDetail` already provides enough data for immediate presentation. Session actions own startup safeguards and distinguish actual start failure from refresh failure after a successful start. `startingTasks` already drives task-page pending feedback. Compose settles a saved result before close, and its idempotent settlement prevents cancellation from replacing success.

## Goals / Non-Goals

**Goals:**
- Make successful persistence the boundary between dialog-owned submission and app-owned startup.
- Keep saved-task identity and task-scoped recovery available after dialog destruction.
- Reuse existing task presentation, startup actions, and compose contracts.

**Non-Goals:**
- Change backend task creation, provider startup, dependency checks, or workspace decisions.
- Redesign task editing or the creation form.
- Introduce persistent background job storage, a new plugin API, or a general workflow engine.
- Refactor unrelated task or terminal code.

## Decisions

### 1. Hand the saved task to the app before asynchronous follow-up work

The dialog retains validation, draft handling, attachment serialization, persistence, and its in-flight submission guard. After successful persistence it delivers a completion containing the saved task and explicit intent to the app controller. The controller accepts ownership synchronously, publishes the saved detail for rendering, and closes the corresponding dialog. It then navigates only for the start intent and launches the existing startup action with an observed promise.

Use the existing task-detail cache, with immutable Map reassignment, to make the created record available before routing. Reconcile with normal refreshes in the background. A refresh failure must not discard the saved detail or turn successful persistence back into a creation failure. Remove refresh prerequisites from the post-save navigation path; do not remove refreshes needed for later reconciliation.

For backlog intent, publish the saved task and dismiss only. Do not invoke reset-to-board or navigation helpers. Preserve page, selection, and board filters.

Alternative rejected: delete only the saved-message markup. That hides the symptom but retains the blocking dialog and dialog-owned retries. Closing in a `finally` block is also wrong because failed saves must retain their draft.

### 2. Startup state outlives the dialog

Keep startup execution in the existing session-action owner, not a promise whose failure is handled by the destroyed dialog. Reuse `startingTasks` for pending state. Store any required startup error state by task identifier in the app/session layer and expose it to the task page. Include preflight failures and canceled workspace decisions so the page does not remain stuck in a starting state.

Route the task-page retry through the existing start action for that identifier. Clear stale failure feedback when a new attempt begins and on success. Keep concurrent-start and active-session checks authoritative. Preserve the current distinction between failed startup and failed refresh or terminal focus after startup; the latter must not enable a second startup.

All asynchronous follow-up operations must have an error owner after close. Dialog cleanup continues to dispose prompt and attachment resources only; it must not cancel or release the accepted task startup. Do not add prop-keyed teardown effects.

Alternative rejected: fire and forget the old dialog callback. That loses error handling and leaves recovery dependent on disposed dialog state. A new persisted job subsystem is unnecessary for an existing session-action operation.

### 3. Compose settlement is part of accepting the saved task

Keep the ordinary and plugin-composed flows on the same intent-aware handoff. For compose, retain the originating request identity and settle its saved result before any close path can report cancellation. Dismiss only the originating request, not a newer compose request. Preserve `started` as the existing indication that the start path was selected and available, not proof that provider startup completed. Startup failure is reported on the task, not by attempting to resettle the compose promise.

Alternative rejected: wait for startup before delivering the compose result. That recreates the delayed handoff and changes caller-visible completion semantics.

### 4. Test the ownership boundary with deferred operations

Extend workflow and controller tests with controllable persistence, refresh, and startup promises. Assert that save success closes and opens the task while refresh and startup are unresolved. Test rejection after destruction, task-scoped retry, failed persistence, and repeated submit attempts. Add component-level assertions that the saved-task retry screen never appears and that backlog save does not invoke navigation from either the board or another selected page.

Exercise compose success and close ordering, including a newer request arriving before old follow-up work completes. Test session-action behavior for canceled preflight and post-start refresh failure. Test observable state and calls rather than styling.

## Risks / Trade-offs

- Unmounting before ownership transfer could lose errors or cancel compose success. Mitigation: accept the saved record and settle the originating compose result before dismissal; verify ordering with deferred-promise tests.
- A stale list refresh could hide the new task. Mitigation: publish saved detail independently of list refresh and test both delayed and failed refreshes.
- Global-only errors could leave task-page recovery unclear. Mitigation: retain startup failures by task identifier and make retry act on that identifier.
- A retry could duplicate a running session. Mitigation: reuse existing guarded startup and preserve successful-start versus refresh-failure classification.
- Changing shared startup behavior could affect other entry points. Mitigation: keep the change focused on handoff and task feedback, and run the full renderer subsystem checks.

## Migration Plan

No data migration, new dependency, or feature flag is required. Implement the tests and renderer change together. Validate with `pnpm test`, `pnpm exec tsc --noEmit`, and `pnpm lint`, plus focused handoff and compose regressions. Perform a desktop smoke test with delayed and failed startup and backlog saves from multiple locations. If implementation reaches a shared package or contract boundary, add that subsystem's full checks and applicable contract checks.

Rollback consists of reverting the renderer change and its tests. Tasks already created remain valid; do not delete or recreate them as part of rollback.

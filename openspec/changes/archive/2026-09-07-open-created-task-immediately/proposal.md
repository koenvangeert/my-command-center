## Why

After creating a task, the creation dialog replaces the form with a saved-task retry message while startup is still pending. Users should reach the saved task immediately rather than wait behind a dialog that suggests something failed.

## What Changes

- For Create & Start, close the creation dialog and open the saved task as soon as persistence succeeds, without waiting for startup or a task-list refresh.
- Show startup progress, failure, and retry on the task page, using the saved task rather than repeating creation.
- For Save to backlog, close the dialog without changing the current page or selection. Do not force a return to the board.
- Keep validation and persistence failures in the creation dialog with the draft intact.
- Preserve plugin compose result delivery and existing task-start safeguards when the dialog unmounts.

## Capabilities

### New Capabilities

- `task-creation-handoff`: Post-save dialog dismissal, intent-specific navigation, and task-owned startup recovery.

### Modified Capabilities

None. Existing specs do not define the creation dialog's post-save handoff.

## Impact

- Renderer creation workflow and dialog, app task-creation controller, shell dialog wiring, and task-page startup feedback.
- Existing session actions and plugin compose integration must retain their start and result-delivery semantics.
- Regression tests for delayed startup, failure, retries, navigation, and compose completion.
- No intended IPC, database, CLI, plugin SDK contract, or dependency changes.

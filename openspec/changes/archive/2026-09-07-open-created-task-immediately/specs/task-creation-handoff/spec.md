## Purpose

Defines how task creation hands control back to the user after saving, with intent-specific navigation and startup recovery that does not recreate a saved task.

## ADDED Requirements

### Requirement: Create and start hands off immediately after saving

When Create & Start successfully saves a task, the system SHALL close the creation dialog and open that task without waiting for startup completion or a task-list refresh. The creation dialog SHALL NOT display an intermediate saved-task retry screen.

#### Scenario: Startup remains pending
- **WHEN** Create & Start saves a task and startup is still pending
- **THEN** the creation dialog is closed and the saved task is open
- **AND** the task page shows that startup is pending

#### Scenario: Task-list refresh is slow or fails
- **WHEN** Create & Start saves a task but the subsequent task-list refresh is delayed or fails
- **THEN** the saved task opens without waiting for that refresh
- **AND** refresh failure does not reopen the creation dialog or initiate another creation

### Requirement: Saving to backlog preserves the current location

When Save to backlog successfully saves a task, the system SHALL close the creation dialog without starting the task or changing the user's current page or selection.

#### Scenario: Save from the board
- **WHEN** the user saves a task to backlog from the board
- **THEN** the dialog closes and the user remains on the board with the same view state
- **AND** the task is not started

#### Scenario: Save from another page
- **WHEN** the user saves a task to backlog while viewing another task or another page
- **THEN** the dialog closes without navigating to the board or the newly saved task
- **AND** the previous page and selection remain active

### Requirement: Startup recovery belongs to the saved task

The system SHALL continue an accepted startup attempt after the creation dialog is destroyed. Startup progress and failure feedback SHALL be associated with the saved task and accessible on its page. A retry SHALL start the existing task without repeating creation and SHALL retain existing concurrent-start, active-session, dependency, and workspace safeguards. Refresh or presentation failure after a successful start SHALL NOT be represented as a failed start eligible for duplicate startup.

#### Scenario: Startup fails after dismissal
- **WHEN** startup fails after Create & Start has closed the creation dialog
- **THEN** the saved task remains available and its page displays the failure with an option to retry startup
- **AND** the creation dialog remains closed

#### Scenario: User retries a failed start
- **WHEN** the user retries startup from the saved task page
- **THEN** the attempt targets the same task identifier without creating another task
- **AND** concurrent or already-active startup remains guarded

#### Scenario: Start is canceled by a workspace decision
- **WHEN** the user cancels a required workspace decision after the task has been saved
- **THEN** the task remains saved and the creation dialog remains closed
- **AND** the task page allows a later start without another creation

#### Scenario: Refresh fails after successful startup
- **WHEN** startup succeeds but a later refresh or terminal presentation operation fails
- **THEN** the system does not offer to restart the running task as if startup had failed
- **AND** the failure does not cause another task or session to be created

### Requirement: Unsuccessful saves retain the creation draft

Before persistence succeeds, the system SHALL retain the creation dialog and draft when validation or saving fails. It SHALL display the failure without navigating or starting a task.

#### Scenario: Persistence rejects the task
- **WHEN** saving a new task fails before a task has been persisted
- **THEN** the dialog remains open with the prompt, properties, and attachments intact
- **AND** the user can correct or retry the submission without navigation

#### Scenario: Validation prevents submission
- **WHEN** required input or task defaults prevent submission
- **THEN** the dialog displays the validation problem and preserves the draft
- **AND** no task creation or startup occurs

### Requirement: Plugin compose completion survives dialog dismissal

Plugin-initiated creation SHALL use the same navigation behavior for each intent and deliver the saved-task result exactly once. Successful dismissal SHALL NOT replace that result with cancellation. The existing meaning of the compose result's start indicator SHALL remain unchanged; it SHALL NOT become a guarantee that startup has completed.

#### Scenario: Composed task starts asynchronously
- **WHEN** a plugin-composed task is saved with Create & Start while startup remains pending
- **THEN** the caller receives the saved-task result once with the existing start-indicator semantics
- **AND** the dialog closes and the saved task opens without waiting for startup
- **AND** later startup failure is handled on the task page rather than changing the compose result

#### Scenario: Composed task is saved to backlog
- **WHEN** a plugin-composed task is saved with Save to backlog
- **THEN** the caller receives the saved-task result once without a start indication
- **AND** the creation flow closes the dialog without navigating or emitting cancellation

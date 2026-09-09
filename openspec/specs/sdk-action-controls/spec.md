# sdk-action-controls Specification

## Purpose

Provide consistent, accessible action menus and split buttons that host and plugin interfaces can use without app-specific styling or task knowledge.

## Requirements

### Requirement: Shared default action-menu presentation
The SDK action menu SHALL provide compact theme-derived corners, padding, borders, elevation, and distinguishable highlighted, disabled, and destructive item states without consumer CSS. Content SHALL remain readable for long labels and supported themes, and menus SHALL remain within the available viewport.

#### Scenario: Standalone menu without overrides
- **WHEN** a host or plugin renders an action menu with labels and actions only
- **THEN** it receives the same polished default appearance without task-toolbar classes or styles

#### Scenario: Content and theme variation
- **WHEN** a menu displays long labels, optional icons, checkbox items, or disabled and destructive actions in a supported theme
- **THEN** its content remains readable, item states remain distinguishable, and its placement respects the available viewport

### Requirement: Existing menu interaction compatibility
Existing action-menu consumers SHALL retain their public props and selection, checked-item, close-on-select, keyboard navigation, dismissal, and focus behavior. Decorative icons SHALL NOT alter accessible item names.

#### Scenario: Existing consumer upgrades
- **WHEN** a consumer upgrades the SDK without changing its action-menu props
- **THEN** item values and callbacks behave as before, including checked items and items configured to remain open on selection

#### Scenario: Keyboard dismissal
- **WHEN** a keyboard user opens a menu, navigates enabled items, and presses Escape
- **THEN** the menu closes and focus returns to its trigger

### Requirement: Public split-button component
The SDK SHALL export `@openforge-app/plugin-sdk/ui/SplitButton.svelte`. It SHALL render an independently operable primary button and adjacent menu trigger as a joined control, with matching size and variant styling and visible focus indicators for each button. Consumers SHALL be able to provide primary content, an accessible menu label, items, item content, callbacks, and controlled open state without importing app internals.

#### Scenario: Plugin import
- **WHEN** a plugin imports the split button from the published SDK path and supplies its actions
- **THEN** it can render and operate the joined control using SDK assets alone

#### Scenario: Independent actions
- **WHEN** the user activates the primary button
- **THEN** only the primary callback runs and no menu opens
- **WHEN** the user opens the menu and selects an enabled action
- **THEN** only the menu selection callback runs with that action's value, and the primary action and label remain unchanged

### Requirement: Split-button availability and accessibility
The split button SHALL support whole-control, primary-only, and menu-only disabled states. Disabled actions SHALL NOT dispatch callbacks. The menu trigger SHALL have an accessible name and expose its expanded state. Both enabled buttons SHALL be keyboard reachable and operable, and menu dismissal SHALL restore focus according to existing menu behavior.

#### Scenario: Primary operation in progress
- **WHEN** the primary action is disabled while the menu remains enabled
- **THEN** the primary action cannot run and the user can still open and use the menu

#### Scenario: Disabled control or menu
- **WHEN** the entire control is disabled
- **THEN** neither button can be activated
- **WHEN** only the menu trigger is disabled
- **THEN** the primary action remains available and the menu cannot be opened through its trigger

#### Scenario: Keyboard operation
- **WHEN** a keyboard user focuses and activates the menu trigger
- **THEN** its expanded state reflects the open menu and enabled menu items can be navigated and selected without activating the primary action

### Requirement: Task toolbar uses shared controls without behavior changes
The task toolbar SHALL use the SDK split button for Complete and its secondary actions without local menu or joined-button presentation overrides. Completion confirmation, completing state, Set aside, Move task back in focus, and task-switch menu dismissal SHALL retain their current behavior.

#### Scenario: Task actions after migration
- **WHEN** a doing task is displayed
- **THEN** Complete invokes the existing completion flow and the secondary action reflects whether the task is out of focus

#### Scenario: Task identity changes
- **WHEN** the displayed task changes while the secondary menu is open
- **THEN** the menu closes and subsequent actions target the newly displayed task

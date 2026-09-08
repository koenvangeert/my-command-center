## Purpose

Defines the semantic styling and feedback interfaces that let OpenForge host views and plugins follow the active theme without relying on host-provided daisyUI styles.

## ADDED Requirements

### Requirement: Semantic color utility contract

OpenForge SHALL provide documented semantic color utilities for application surfaces, text, borders, accents, and feedback colors. These utilities SHALL resolve against the active OpenForge theme tokens, support opacity modifiers and interaction variants, and coexist with direct use of documented theme tokens. Utilities SHALL NOT require a theme identifier to match a built-in name.

#### Scenario: Apply a translucent interaction color
- **WHEN** a caller applies a semantic accent background with an opacity modifier to a hover state
- **THEN** the resting background remains unchanged until hover
- **AND** the hovered background uses the requested opacity of the active accent color without making child text translucent

#### Scenario: Use a semantic boundary or foreground
- **WHEN** a caller uses a semantic text, border, or focus-ring color under an available contributed theme
- **THEN** the rendered color derives from the corresponding active token, including any requested opacity
- **AND** direct-token consumers and semantic utility consumers resolve consistently

### Requirement: Public feedback building blocks

The plugin SDK SHALL expose documented loading indicator, alert, and progress building blocks with self-contained theme-responsive styling. They SHALL render in a consumer that provides the documented theme tokens but neither Tailwind nor daisyUI. Existing public UI imports and callbacks SHALL remain compatible.

#### Scenario: Plugin renders feedback without host utility CSS
- **WHEN** a plugin imports the published loading, alert, and progress controls into a token-providing page without host utility CSS
- **THEN** each control renders its supported presentation and semantics
- **AND** a theme token update changes its presentation without recreating the control

#### Scenario: Loading feedback has one accessible message
- **WHEN** a loading indicator accompanies an existing accessible loading message
- **THEN** the indicator can be decorative without duplicating the announcement
- **AND** a standalone loading indicator can expose a caller-supplied accessible name

#### Scenario: Alert urgency belongs to the caller
- **WHEN** a caller presents error, success, warning, or informational feedback
- **THEN** the alert supports the corresponding semantic presentation
- **AND** the caller can preserve an existing alert, status, or non-live announcement policy rather than urgency being inferred from color

#### Scenario: Progress is determinate or indeterminate
- **WHEN** the caller provides a valid value and maximum
- **THEN** progress exposes the current value and range to assistive technology
- **AND** omitting the value presents indeterminate progress without reporting a fabricated percentage

### Requirement: Theme switching preserves active work

Semantic styling and feedback controls SHALL adopt all available built-in themes and valid contributed themes while mounted. Switching SHALL retain the selected stable identifier and preserve focus, user input, view state, and running sessions. Existing unavailable-theme fallback and plugin-owned custom styling SHALL remain unchanged.

#### Scenario: Switch from light to dark to a contributed theme
- **WHEN** a user switches from OpenForge Light to OpenForge Dark and then to a valid namespaced contributed theme while host and plugin views are mounted
- **THEN** their semantic colors, feedback, and token-driven geometry reflect each selected theme
- **AND** the contributed theme identifier remains unchanged
- **AND** focused controls, edited values, open views, and sessions are retained

#### Scenario: Contributed theme is unavailable
- **WHEN** a stored contributed theme cannot be resolved
- **THEN** existing fallback and diagnostic behavior still applies
- **AND** presentation does not depend on compatibility styles for the missing identifier

### Requirement: Migration preserves presentation and interaction

Replacing legacy presentation SHALL preserve control placement, information density, layout dimensions, responsive behavior, opacity, and hover, pressed, focus-visible, selected, invalid, and disabled states. Existing theme-defined geometry SHALL remain effective. Keyboard operation, accessible names, feedback announcements, and reduced-motion behavior SHALL remain available.

#### Scenario: Interact with a migrated control
- **WHEN** a user activates an enabled migrated control with the keyboard or pointer
- **THEN** the same action occurs as before migration
- **AND** focus remains visible and disabled controls do not activate

#### Scenario: Render feedback in a narrow view
- **WHEN** migrated alerts, loading indicators, or progress controls render in a supported narrow desktop view
- **THEN** they preserve their intended bounds and wrapping without new clipping or horizontal overflow

#### Scenario: Reduced motion is enabled
- **WHEN** a user enables reduced motion and renders migrated UI
- **THEN** nonessential transitions remain suppressed
- **AND** loading and progress state remain understandable without relying on animation

### Requirement: First-party presentation is independent of legacy host styling

The host renderer, shared theme-aware packages, and bundled plugin views SHALL render their supported controls and semantic presentation without host-provided daisyUI styles. Documented SDK components and theme tokens SHALL remain supported, while undocumented legacy host classes SHALL NOT be required for their presentation.

#### Scenario: Run a production build without legacy styles
- **WHEN** the production application loads without daisyUI styles and the user opens project setup, attention, review, file, and terminal views
- **THEN** controls, feedback, text, boundaries, and content remain styled through OpenForge's supported interfaces
- **AND** selecting built-in or contributed themes continues to update those views

## Context

See proposal.md for motivation. `AnchoredMenu.svelte` already owns portalling, positioning, menu semantics, and focus behavior through Bits UI. It supports item snippets and checked items. The toolbar currently composes Button and AnchoredMenu and reaches into the portalled menu with `.of-menu-content:has(.toolbar-more-item)` selectors. The SDK publishes individual Svelte component entrypoints through an explicit package contract.

This design is needed because presentation moves across app and SDK boundaries and a public component contract is added. The existing `remove-daisyui`, `add-ui-storybooks`, and `add-angular-extensible-theming` changes may touch related control styling or stories; coordinate overlapping files without absorbing their scope.

## Goals / Non-Goals

Goals:
- Give shared controls ownership of their presentation while consumers own action meaning and async operations.
- Reuse one menu interaction implementation and existing button styling.
- Preserve standalone menu source compatibility and task action behavior.

Non-goals:
- A selected-value dropdown, a primary action that changes after selection, or a new task-action framework.
- Replacing Bits UI, redesigning Select or SearchableSelect, or introducing an icon registry.
- Rewriting every toolbar or changing task lifecycle behavior.

## Decisions

### Put menu presentation in AnchoredMenu

Move the compact corners, balanced padding, and softer border into the default SDK menu styles. Use existing theme tokens rather than fixed toolbar geometry. Retain visible highlight and disabled/danger states, portalled positioning, and item snippets. Validate long labels and constrained viewports rather than copying a toolbar-specific fixed width.

Do not retain a special task-menu skin. An opt-in variant would leave plugins with the old default and require every consumer to discover the new appearance. Avoid changing unrelated popovers or theme-wide radius tokens.

### Compose a dedicated SplitButton

Add `SplitButton.svelte` next to Button and AnchoredMenu. It composes those controls rather than duplicating dropdown roots, focus observers, or keyboard handlers. Joined borders, corner treatment, disclosure icon, open state appearance, and focus stacking belong inside SDK code.

Expose primary content through a children snippet, an `onClick` callback, a required `menuLabel`, menu `items`, `onSelect`, optional item snippet, and bindable `open` with `onOpenChange`. Reuse Button size and variant types. Provide `disabled`, `primaryDisabled`, and `menuDisabled`, with whole-control disabled taking precedence. Forward optional menu side, alignment, and offset using the existing menu types; default the split button to bottom/end alignment. These are proposed public names to check against SDK conventions before coding, not permission to break existing Button or AnchoredMenu names.

If trigger styling requires an internal composition hook in AnchoredMenu, keep it narrowly owned by SDK controls and preserve standalone defaults. Do not ask consumers to target internal CSS classes or supply portal selectors. Use Svelte 5 runes and on-prefixed callback props.

Alternative: one component with a split-mode boolean would entangle primary-button concerns with the standalone menu API. A separate composed component keeps each purpose clear.

### Keep state and task meaning in consumers

The SDK dispatches actions; it does not await completion to infer busy state or catch domain errors. Callers control availability and primary content. The toolbar retains confirmation, completion, out-of-focus controllers, labels, icons, and identity-driven menu dismissal. Its completing state maps to primary-only disabled to preserve the current menu availability. Menu selection never changes the primary action.

Item snippets remain the way to render decorative icons and labels. The SDK must not import task presentations or app stores. Preserve accessible item names and menu text values when rendering custom content.

### Publish and demonstrate the real component

Register the new public Svelte entrypoint everywhere required by SDK entrypoint and published-contract checks. Add documented host/plugin usage through the public import, including disabled states and icon snippets. Add component stories for both standalone menus and split buttons, including supported sizes/variants, keyboard focus, long labels, and supported themes. Use a published-entrypoint fixture so source aliases cannot conceal missing package assets.

## Risks / Trade-offs

- Shared menu styling affects existing consumers. Mitigation: inventory consumers and test standalone, checked, destructive, disabled, and custom-content menus in browser stories before accepting baselines.
- Joined borders can obscure focus or disagree across variants. Mitigation: reuse Button styling, check both segments in browser tests, and verify all supported sizes and variants.
- Portal selectors can accidentally affect unrelated controls. Mitigation: SDK-owned styling without task markers; verify a standalone menu and split button on the same page.
- Long labels can overflow near viewport edges. Mitigation: use content-aware sizing and existing collision handling, and test narrow available space and zoom.
- The current toolbar design has not had visual acceptance. Mitigation: treat it as a direction, not an approved baseline; require rendered review of the shared controls.

## Migration Plan

1. Add SDK behavioral tests and the public component, update shared menu presentation, and register its package entrypoint.
2. Replace the toolbar's manual composition, preserving callbacks and state. Remove its joined-button and portalled-menu CSS; keep task-specific icon/content rendering only.
3. Add docs and stories, run SDK and renderer validation plus public package checks, and perform supported-theme visual review.
4. Ship the additive export and shared appearance together. No data migration is needed. Rollback by reverting the SDK and toolbar changes together so consumers do not reference an unavailable export.

Validation scope includes full affected SDK tests, build/type checks, entrypoint and published-contract checks, renderer tests and static checks, and relevant browser/visual checks. Rust and unrelated plugin subsystem checks are not required unless implementation expands those boundaries. Record skipped environment-dependent checks as gaps, not passes.

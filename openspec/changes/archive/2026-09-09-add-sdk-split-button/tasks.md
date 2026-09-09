## 1. SDK behavior and presentation

- [x] 1.1 Add failing public-component tests for independent primary/menu actions, disabled-state precedence, controlled open state, accessible names, and primary-label stability; verify the new tests fail before implementation and existing AnchoredMenu tests pass.
- [x] 1.2 Implement SplitButton by composing SDK Button and AnchoredMenu with shared size/variant types, item snippets, caller-controlled state, and SDK-owned joined styling; verify the tests from 1.1 pass without app imports or copied menu focus logic.
- [x] 1.3 Move compact menu presentation into AnchoredMenu defaults and remove the need for task marker selectors; verify standalone, checked, disabled, destructive, and custom-content menu tests retain their existing behavior.
- [x] 1.4 Add browser coverage for both controls covering keyboard selection, Escape/outside dismissal, focus restoration, long labels, constrained viewports, and independently focused split segments; verify the browser suites pass and decorative icons do not change accessible names.

## 2. Public SDK distribution

- [x] 2.1 Register the public SplitButton Svelte export and all required entrypoint/package asset registries; verify `pnpm --filter @openforge-app/plugin-sdk check:entrypoints`, `pnpm --filter @openforge-app/plugin-sdk build`, and `pnpm --filter @openforge-app/plugin-sdk check:contract` pass.
- [x] 2.2 Add a public-entrypoint consumer fixture and document standalone menu and split-button usage, snippets, disabled states, and controlled open state; verify the packaged consumer resolves and renders the component without renderer imports or local styling overrides.

## 3. Task toolbar adoption

- [x] 3.1 Extend toolbar regression coverage for completion confirmation, completing state with available secondary actions, both out-of-focus labels, and task-switch dismissal; verify tests against the existing behavior before replacing the composition.
- [x] 3.2 Replace the toolbar's Button/AnchoredMenu pair with SplitButton, preserving task controllers and action content, and delete its joined-button and portalled-menu overrides; verify `pnpm exec vitest run src/components/task-detail/TaskDetailToolbar` passes and no toolbar marker is needed to style the menu.

## 4. Visual acceptance and affected-system validation

- [x] 4.1 Add or update registered component stories for standalone menus and SplitButton, covering supported sizes/variants, long labels, icon items, checked items, disabled/destructive states, and keyboard focus; verify the stories build and are registered in the component coverage inventory.
- [x] 4.2 Follow `docs/storybook-visuals.md` to review rendered controls and the migrated toolbar across supported themes and constrained widths; verify joined borders, readable labels, focus visibility, viewport placement, and absence of cross-menu style leakage, and record reviewed screenshots rather than accepting uninspected baselines.
- [x] 4.3 Run full affected SDK validation with `pnpm --filter @openforge-app/plugin-sdk test`, `build`, `check:entrypoints`, and `check:contract`; verify all succeed, including applicable browser suites, and record any skipped environment-dependent check as a gap.
- [x] 4.4 Run renderer tests and static checks using `pnpm exec vitest run src`, `pnpm exec tsc --noEmit`, and `pnpm lint`, plus applicable cross-boundary and story checks from the testing guide; verify success or disclose pre-existing failures separately. Do not run unrelated Rust/plugin checks unless the implementation expands into those subsystems.
- [x] 4.5 Run `git diff --check` and the required fresh-context review against the complete task diff, resolve or report findings, and update task Handoff Notes; verify the review outcome and successful notes replacement before completion.

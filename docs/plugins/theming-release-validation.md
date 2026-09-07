# Extensible theming release validation

Task KVG-4530 validates the release planned by KVG-4489 and `openspec/changes/add-angular-extensible-theming`. Baseline: `4732d5fd047940e8656f6d563ea9924e638fa053`. This slice changes author documentation, SDK component references, and example instructions, not public runtime behavior. Existing package fixtures already declare `themes` and exercise the new UI exports; they remain compatible.

## Scope and evidence

Run the full affected renderer, plugin SDK/runtime, built-in plugin, terminal runtime, PR review UI, package, production-build, and Electron boundary checks. Root Vitest includes workspace plugin/runtime and PR review UI tests. No Rust source, database migration, or IPC schema changes in this slice; the real development Electron launch still builds the Rust sidecar.

Local logs for this run are in `/tmp/KVG-4530-checks-mvC3hH`. These are temporary evidence, not checked-in baselines.

| Check | Result |
| --- | --- |
| `pnpm i` | Passed; lockfile unchanged. Dependency build scripts for esbuild, webgpu, and @vgpu/adapter-node were not approved by this task. |
| `pnpm packages:test` | Passed. SDK: 59 files, 439 tests. Terminal: 55 files, 229 passed, 1 skipped. |
| `pnpm packages:build` | Passed, including SDK entrypoint registry and terminal TypeScript. |
| `pnpm packages:contract:check` | Passed, including clean packed consumers, public UI declarations and external-plugin build. |
| `pnpm packages:metadata:check` | Passed. |
| `pnpm packages:pack:dry-run` | Passed. |
| `pnpm build:plugins` | Passed for all five built-in plugin packages. |
| Example package dry-pack | Passed; frontend, 139-token palette, both selected stylesheets and ordinary view CSS included. |
| Example public SDK activation and disposal | Passed; `selected-theme-fixture:paper` validates and disposal removes it. |
| New component documentation examples | Select, Tabs, AnchoredMenu and Tooltip snippets compile; all 22 documented public UI imports exist in package exports. |
| Local documentation links | 41 relative links checked for paths and heading anchors; all 22 documented UI imports resolve. |
| `pnpm test` | Passed: 721 files passed, 2 skipped; 5,918 tests passed, 14 skipped. |
| `pnpm exec tsc --noEmit`; `pnpm lint` | Passed, including import boundaries and UI migration inventory. |
| `pnpm --filter @openforge-app/pr-review-ui check` | Passed. |
| `pnpm -r --filter './plugins/*' --if-present typecheck` | Passed for GitHub sync and task browser. Other built-ins define no typecheck script. |
| `pnpm -r --filter './plugins/*' --if-present test` | Passed: file viewer 97, terminal 39, task browser 63, task schedules 108, GitHub sync 363 tests. |
| `pnpm build` | Passed; large-chunk warning remains. |
| `pnpm electron:contract:check`; `pnpm electron:build` | Passed. |

## Electron matrix

Two isolated development launches built the Rust sidecar, exposed DevTools, loaded the renderer, and reached `READY`, then Electron exited before scenario execution. Later CDP connections returned `ECONNREFUSED` on ports 54715 and 56259. The second attempt kept the owning Node process alive; Electron still exited. Logs show orderly sidecar shutdown, not an identified crash. The quit initiator is unresolved.

The attempts used disposable app-data and Electron profiles under `/tmp/openforge-desktop-test-qARQuY` and `/tmp/openforge-desktop-test-g9CTuB`. Remaining owned launcher/Vite processes were stopped. Runtime directories and logs were retained for investigation. No plugin was installed into the user's active app for this validation.

| Scenario | Result |
| --- | --- |
| Built-in light | Unverified beyond startup. |
| Built-in dark | Blocked by Electron exit. |
| Token-only contribution | Blocked by Electron exit. |
| Selected-CSS contribution | Blocked by Electron exit. |
| Broken-theme recovery | Blocked by Electron exit. |
| Selection and restart restoration | Blocked by Electron exit. |
| Reload and disable fallback | Blocked by Electron exit. |
| Mounted terminal, diff and Mermaid | Blocked by Electron exit. |
| Keyboard focus and reduced motion | Blocked in Electron; automated suites do not replace this check. |

## Gaps and follow-up

This is not a release sign-off. Automated checks passed, but OpenSpec task 8.6 and the Electron acceptance matrix remain unfinished. Browser-only fixtures and controlled jsdom events do not replace real Electron evidence.

The full suite reports 14 skipped tests across its normal conditional/opt-in coverage. The terminal package reports one skipped test. Separate terminal presentation conformance, opt-in Markdown/interaction visual runs, Storybook screenshot approval, packaged-app smoke, and the live terminal invariant scenarios were not run. Rust test/check/clippy suites were not selected for this documentation-only diff; the development sidecar build passed. Production builds emitted a large-chunk warning. These results do not guarantee arbitrary contributed CSS is accessible or usable.

One fresh-context review found an incomplete missing-stylesheet recipe. The instructions now require app enablement and explicit selection after reinstalling. The reviewer otherwise found no substantive API errors and withheld approval pending Electron evidence. No second review was run. At the user's request, the current work is being submitted as a draft pull request; the implementation completion gate remains unsatisfied.

Follow-up tasks, both linked to KVG-4489 and KVG-4530:
- KVG-4766: reconcile stale non-theming plugin docs about removed task summaries and backend worker ownership.
- KVG-4768: investigate isolated Electron shutdown after readiness. Its dependency links follow the requested cleanup workflow; resuming the blocked verification needs an explicit decision about scheduling this prerequisite work.

No unrelated cleanup was fixed inline. KVG-4489 was not modified or closed.

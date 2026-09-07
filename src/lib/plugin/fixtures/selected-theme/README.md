# Selected theme fixture

This ready-to-install Trusted Plugin registers `selected-theme-fixture:paper`. It ships a complete palette and two theme stylesheets. `view.css` is ordinary plugin CSS and is deliberately not a theme stylesheet.

## Try it in OpenForge

1. Install this directory as a local plugin. Enable **Selected theme fixture** in Global Settings.
2. Confirm **Fixture Paper** appears in the theme preference, with plugin ownership. Merely enabling the plugin must not add a brown line at the top of the window.
3. Select **Fixture Paper**. The canvas becomes warm paper and a brown line appears at the top. Both `--selected-theme-fixture-paper` and `--selected-theme-fixture-accents` become `applied` on the document root.
4. Restart OpenForge. The same qualified theme ID, palette, and CSS should return.
5. Reload the plugin. The old stylesheet elements disappear and the new generation restores the selected theme.
6. Switch to a built-in theme. The line and both fixture custom properties disappear; the plugin's view stylesheet remains loaded.
7. Select **Fixture Paper** again and disable or uninstall the plugin. Selection falls back to built-in light, and all of the plugin's stylesheet elements disappear.

To check a load failure, copy this fixture to a temporary directory, remove `accents.css` from the copy, then reinstall that copy. Explicitly app-enable the installed plugin and select **Fixture Paper** before expecting the stylesheet error. Reinstalling or reloading does not enable a disabled plugin, and reload does not recopy source changes. The load error must identify `selected-theme-fixture`; the current valid theme remains usable. Reinstall the intact fixture before enabling and selecting it again. Use a disposable app profile for this check.

## Package and token-only variant

From the repository root, install and explicitly enable the example:

```sh
openforge plugin install --path "$PWD/src/lib/plugin/fixtures/selected-theme"
openforge plugin app enable --plugin-id selected-theme-fixture
```

The fixture contains ready-built JavaScript and uses only public SDK entry points. It needs no Svelte build. `tokens.js` supplies every required semantic token, including code and terminal colors. Package `files` includes both theme stylesheets and the separate ordinary `view.css`. Check the published file list with `npm pack --dry-run` from this directory.

For a token-only check, copy this directory to a temporary location, omit the `stylesheets` property in `frontend.js`, and install the copy. Keep the complete token record. Select **Fixture Paper** and verify its warm canvas without the brown line or selected stylesheet markers. Reinstall the original to return to the selected-CSS case.

For valid CSS that obscures settings, recover from a separate terminal with `openforge plugin app disable --plugin-id selected-theme-fixture`. This needs the live app bridge. Confirm built-in light and restart persistence before installing a corrected package. See the [theme guide](../../../../../docs/plugins/theming.md) for trust limits, lifecycle guarantees, packaging, and the full testing matrix.

## Automated coverage

From the repository root:

```sh
pnpm exec vitest run src/lib/plugin/pluginRegistry.themeStylesheets.test.ts src/lib/themeStylesheetLifecycle.test.ts
```

These tests exercise the real plugin loader, registration lifecycle, settings controller, document adapter, and theme registry. IPC and module acquisition are test boundaries. jsdom load/error events are controlled explicitly so tests can hold candidates inactive and force races. They do not verify browser CSS rendering.

The fixture uses only public SDK imports. Trusted theme CSS can alter the whole app and break layout or accessibility; normal theme authors should prefer semantic tokens.

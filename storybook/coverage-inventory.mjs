// Basic SDK controls belong to KVG-4691; composite exports belong to KVG-4692.
const sdkActions = ['default', 'disabled', 'loading', 'narrow-overflow', 'keyboard'].map(state => `components-plugin-sdk-actions--${state}`)
const sdkFields = ['default', 'selected', 'disabled', 'validation', 'narrow-overflow', 'keyboard'].map(state => `components-plugin-sdk-fields--${state}`)
const sdkSelectors = ['default', 'selected', 'disabled', 'validation', 'open', 'narrow-overflow', 'empty', 'no-matches', 'keyboard'].map(state => `components-plugin-sdk-selectors--${state}`)
const sdkPresentation = ['default', 'narrow-overflow'].map(state => `components-plugin-sdk-presentation--${state}`)
const sdkNavigation = ['default', 'selected', 'collapsed', 'narrow-overflow', 'keyboard'].map(state => `components-plugin-sdk-navigation--${state}`)

/** @type {import('./coverage-types.ts').CoverageInventory} */
const inventory = {
  pages: [
    {
      source: 'src/components/shell/ApplicationShell.svelte',
      stories: [
        'application-shell--expanded',
        'application-shell--collapsed',
        'application-shell--zen',
        'application-shell--global-view',
        'application-shell--toggle-sidebar',
      ],
    },
    {
      source: 'src/components/focus-board/FocusBoard.svelte',
      stories: [
        'pages-focus-board--populated',
        'pages-focus-board--empty',
        'pages-focus-board--loading',
        'pages-focus-board--failure',
        'pages-focus-board--attention',
        'pages-focus-board--filtered',
        'pages-focus-board--narrow',
        'pages-focus-board--overflow',
        'infrastructure-host-frames--host-page',
      ],
    },
    {
      source: 'src/components/task-detail/TaskDetailView.svelte',
      stories: [
        'pages-task-detail--backlog',
        'pages-task-detail--active',
        'pages-task-detail--waiting',
        'pages-task-detail--failed',
        'pages-task-detail--completed',
        'pages-task-detail--dependency',
        'pages-task-detail--terminal',
        'pages-task-detail--long-content',
        'pages-task-detail--review',
      ],
    },
    {
      source: 'src/components/task-detail/SelfReviewView.svelte',
      stories: [
        'pages-self-review--populated',
        'pages-self-review--empty',
        'pages-self-review--loading',
        'pages-self-review--failure',
        'pages-self-review--long-content',
        'pages-self-review--narrow',
        'pages-self-review--send-feedback',
        'pages-self-review--finish-loading',
      ],
    },
  ],
  components: [
    { source: 'packages/plugin-sdk/src/ui/Button.svelte', stories: ['components-button--primary', ...sdkActions] },
    { source: 'packages/plugin-sdk/src/ui/ButtonControl.svelte', stories: sdkActions },
    { source: 'packages/plugin-sdk/src/ui/IconButton.svelte', stories: sdkActions },
    { source: 'packages/plugin-sdk/src/ui/TextField.svelte', stories: sdkFields },
    { source: 'packages/plugin-sdk/src/ui/Textarea.svelte', stories: sdkFields },
    { source: 'packages/plugin-sdk/src/ui/Checkbox.svelte', stories: sdkFields },
    { source: 'packages/plugin-sdk/src/ui/Switch.svelte', stories: sdkFields },
    { source: 'packages/plugin-sdk/src/ui/Select.svelte', stories: sdkSelectors },
    { source: 'packages/plugin-sdk/src/ui/SearchableSelect.svelte', stories: sdkSelectors },
    { source: 'packages/plugin-sdk/src/ui/Badge.svelte', stories: sdkPresentation },
    { source: 'packages/plugin-sdk/src/ui/Panel.svelte', stories: sdkPresentation },
    { source: 'packages/plugin-sdk/src/ui/FileTypeIcon.svelte', stories: sdkPresentation },
    { source: 'packages/plugin-sdk/src/ui/PluginSidebarLink.svelte', stories: sdkNavigation },
  ],
  // Unadopted UI is reported by discovery, never parked here to silence coverage.
  exclusions: [],
}

export default inventory

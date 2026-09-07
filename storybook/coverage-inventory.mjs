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
        'application-shell--narrow',
        'application-shell--shortcuts',
        'application-shell--quit-confirmation',
        'application-shell--error-feedback',
        'application-shell--checkpoint',
        'application-shell--pipeline-failure',
        'application-shell--task-created',
        'application-shell--rate-limited',
        'application-shell--dialog-with-feedback',
        'application-shell--navigate',
        'application-shell--open-close-dialogs',
        'application-shell--dismiss-feedback',
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
    { source: 'src/components/shell/AppShortcutHelpDialog.svelte', stories: ['application-shell--shortcuts', 'application-shell--open-close-dialogs'] },
    { source: 'src/components/shell/AppCloseConfirmationDialog.svelte', stories: ['application-shell--quit-confirmation', 'application-shell--dialog-with-feedback', 'application-shell--open-close-dialogs'] },
    { source: 'src/components/feedback/toasts/ToastHost.svelte', stories: ['application-shell--error-feedback', 'application-shell--checkpoint', 'application-shell--pipeline-failure', 'application-shell--task-created', 'application-shell--rate-limited', 'application-shell--dismiss-feedback'] },
  ],
  components: [
    { source: 'src/components/shell/AppSidebar.svelte', stories: ['components-host-chrome-sidebar--expanded', 'components-host-chrome-sidebar--collapsed', 'components-host-chrome-sidebar--global-selected', 'components-host-chrome-sidebar--plugin-selected', 'components-host-chrome-sidebar--development', 'components-host-chrome-sidebar--select-project'] },
    { source: 'src/components/shell/ProjectSidebarList.svelte', stories: ['components-host-chrome-project-list--expanded', 'components-host-chrome-project-list--collapsed', 'components-host-chrome-project-list--no-selection', 'components-host-chrome-project-list--hidden-projects', 'components-host-chrome-project-list--saving-order'] },
    { source: 'src/components/shell/IconRail.svelte', stories: ['components-host-chrome-project-tools--selected', 'components-host-chrome-project-tools--plugin-selected', 'components-host-chrome-project-tools--shortcuts', 'components-host-chrome-project-tools--modal-suppresses-shortcuts', 'components-host-chrome-project-tools--navigate'] },
    { source: 'src/components/shell/PluginNavigationIcon.svelte', stories: ['components-host-chrome-project-tools--selected', 'components-host-chrome-project-tools--plugin-selected'] },
    { source: 'src/components/shell/PluginSidebarNavigationSlot.svelte', stories: ['components-host-chrome-sidebar--expanded', 'components-host-chrome-sidebar--collapsed', 'components-host-chrome-sidebar--plugin-selected'] },
    { source: 'src/components/shell/StaticPluginSidebarNavigation.svelte', stories: ['components-host-chrome-sidebar--expanded', 'components-host-chrome-sidebar--collapsed', 'components-host-chrome-sidebar--plugin-selected'] },
    { source: 'src/components/project/ProjectPageHeader.svelte', stories: ['components-host-chrome-project-header--default', 'components-host-chrome-project-header--long-content'] },
    { source: 'src/components/feedback/toasts/AppToast.svelte', stories: ['components-feedback-toast--success', 'components-feedback-toast--warning', 'components-feedback-toast--error', 'components-feedback-toast--long-content', 'components-feedback-toast--activate', 'components-feedback-toast--repeat-dismiss', 'components-feedback-toast--auto-dismiss'] },
    { source: 'src/components/shared/ui/ContextMenu.svelte', stories: ['components-host-controls-context-menu--closed', 'components-host-controls-context-menu--open', 'components-host-controls-context-menu--keyboard-selection', 'components-host-controls-context-menu--repeat-open-close'] },
    { source: 'src/components/shared/ui/ContextMenuItem.svelte', stories: ['components-host-controls-context-menu--open', 'components-host-controls-context-menu--keyboard-selection'] },
    { source: 'src/components/shared/ui/ResizableBottomPanel.svelte', stories: ['components-host-controls-bottom-panel--default', 'components-host-controls-bottom-panel--fill-parent', 'components-host-controls-bottom-panel--resize-and-reset'] },
    { source: 'src/components/shared/adapters/MarkdownContent.svelte', stories: ['components-host-controls-markdown--formatted', 'components-host-controls-markdown--long-content', 'components-host-controls-markdown--empty', 'components-host-controls-markdown--open-external-link'] },
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

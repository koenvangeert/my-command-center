import type { Meta, StoryObj } from '@storybook/svelte-vite'
import type { FilesBrowserActions } from '../../../plugins/file-viewer/src/lib/fileBrowserView'
import FileViewerModule from '../../shared/frames/FileViewerModule.svelte'
import { fileViewerScenario } from '../../shared/fixtures/fileViewerScenario'
import { fileViewerModel, type FileViewerModuleState } from '../../shared/fixtures/fileViewerModels'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

type Args = {
  module: 'browser' | 'toolbar' | 'tree' | 'preview' | 'content' | 'markdown'
  state?: FileViewerModuleState
  path?: string | null
}
const meta = {
  title: 'Components/File Viewer',
  component: FileViewerModule,
  parameters: { openforge: fileViewerScenario() },
  args: { module: 'browser', state: 'populated', path: null },
  render: (args, context) => {
    // These are controlled presentation states. The page stories own end-to-end interactions.
    const observe = () => {}
    const actions: FilesBrowserActions = {
      onRetryRootLoad: observe,
      toolbar: { onSearchInput: observe, onClearSearch: observe, onToggleHiddenRootEntries: observe },
      tree: { onRetrySearch: observe, onRetryDirectoryLoad: observe, onRetryRevealPath: observe, onToggleDir: async () => false, onSelectFile: async () => false, onTreeScrollTopChange: observe },
      preview: { onContentScrollTopChange: observe, onRetrySelectedFile: observe, onReturnFocusToSelectedFile: observe, onOpenRepositoryPath: observe },
    }
    return { Component: FileViewerModule, props: { ...args, api: getStoryScenario(context).plugin.api, view: fileViewerModel(args.state, args.path), actions } }
  },
} satisfies Meta<Args>
export default meta
type Story = StoryObj<Partial<Args>>

export const Browser: Story = { args: { path: 'README.md' } }
export const BrowserEmpty: Story = { args: { state: 'empty' } }
export const BrowserLoading: Story = { args: { state: 'loading' } }
export const BrowserFailure: Story = { args: { state: 'failure' } }
export const Toolbar: Story = { args: { module: 'toolbar' } }
export const ToolbarSearch: Story = { args: { module: 'toolbar', state: 'search-empty' } }
export const Tree: Story = { args: { module: 'tree' } }
export const TreeEmpty: Story = { args: { module: 'tree', state: 'empty' } }
export const TreeSearchEmpty: Story = { args: { module: 'tree', state: 'search-empty' } }
export const TreeSearchLoading: Story = { args: { module: 'tree', state: 'search-loading' } }
export const TreeSearchFailure: Story = { args: { module: 'tree', state: 'search-failure' } }
export const TreeSearchLimit: Story = { args: { module: 'tree', state: 'search-limit' } }
export const TreeDirectoryFailure: Story = { args: { module: 'tree', state: 'directory-failure' } }
export const TreeRevealFailure: Story = { args: { module: 'tree', state: 'reveal-failure' } }
export const PreviewEmpty: Story = { args: { module: 'preview' } }
export const Preview: Story = { args: { module: 'preview', path: 'src/main.ts' } }
export const Content: Story = { args: { module: 'content', path: 'src/main.ts' } }
export const ContentLoading: Story = { args: { module: 'content', path: 'src/main.ts', state: 'loading' } }
export const ContentFailure: Story = {
  args: { module: 'content', path: 'src/main.ts', state: 'failure' },
}
export const ContentImage: Story = { args: { module: 'content', path: 'diagram.svg' } }
export const ContentVideo: Story = { args: { module: 'content', path: 'demo.webm' } }
export const ContentBinary: Story = { args: { module: 'content', path: 'archive.bin' } }
export const ContentDocument: Story = { args: { module: 'content', path: 'guide.pdf' } }
export const ContentLarge: Story = { args: { module: 'content', path: 'large.log' } }
export const ContentEmpty: Story = { args: { module: 'content', path: 'empty.txt' } }
export const ContentOverflow: Story = { args: { module: 'content', path: 'long-lines.txt' } }
export const Markdown: Story = { args: { module: 'markdown' } }

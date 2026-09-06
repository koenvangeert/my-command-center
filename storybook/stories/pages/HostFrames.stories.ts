import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import PluginViewState from '../../../packages/plugin-sdk/src/ui/PluginViewState.svelte'
import { FilesViewComponent } from '../../../plugins/file-viewer/src'
import { fileBrowserStates, pendingFileReveal } from '../../../plugins/file-viewer/src/lib/stores'
import { activeProjectId, currentView, projects } from '../../../src/lib/stores'
import { getStoryScenario, type StoryScenarioDefinition } from '../../shared/storyEnvironmentPreview'
import { createStoryStoreAdapter as seed } from '../../shared/environment/storyStoreAdapter'
import FocusBoard from '../../../src/components/focus-board/FocusBoard.svelte'
import ContextMenuItem from '../../../src/components/shared/ui/ContextMenuItem.svelte'
import PageFrame from '../../shared/frames/PageFrame.svelte'
import TaskPaneFrame from '../../shared/frames/TaskPaneFrame.svelte'
import SettingsFrame from '../../shared/frames/SettingsFrame.svelte'
import RowActionFrame from '../../shared/frames/RowActionFrame.svelte'
import StatusFrame from '../../shared/frames/StatusFrame.svelte'
import { createFileEntry, createProject, createTask, createTextFileContent } from '../../shared/fixtures/appFixtures'

const task = createTask({ status: 'backlog' })
const project = createProject()
const filesView = 'plugin:com.openforge.file-viewer:files'
// Foundation smoke only. KVG-4697 owns the File Viewer state catalog.
const fileViewerSmoke = {
  plugin: {
    pluginId: 'com.openforge.file-viewer', projectId: project.id, viewId: filesView,
    projectFileContents: { 'smoke.txt': createTextFileContent({ content: 'Foundation smoke file contents.' }) },
  },
  adapters: () => [
    seed(projects, [project]),
    seed(activeProjectId, project.id),
    seed(currentView, filesView),
    seed(fileBrowserStates, new Map()),
    seed(pendingFileReveal, null),
  ],
} satisfies StoryScenarioDefinition
const meta = {
  title: 'Infrastructure/Host frames',
  component: PluginViewState,
  args: { empty: true, emptyTitle: 'No items' },
  decorators: [(_Story, context) => ({ Component: PageFrame, props: context.parameters.pageFrame ?? {} })],
} satisfies Meta<typeof PluginViewState>
export default meta

export const HostPage: StoryObj<typeof meta> = {
  render: () => ({ Component: FocusBoard, props: {
    projectId: null,
    projectName: 'OpenForge',
    tasks: [], activeSessions: new Map(), ticketPrs: new Map(),
    onOpenTask: fn(), onRunAction: fn(), onNewTask: fn(),
  } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByRole('button', { name: /backlog/i })).resolves.toBeVisible()
  },
}
export const PluginPage: StoryObj<typeof meta> = {
  name: 'Bundled File Viewer smoke',
  parameters: {
    openforge: fileViewerSmoke,
    pageFrame: {
      currentView: filesView,
      pluginNavItems: [{ viewKey: filesView, title: 'Files', icon: 'folder-open', shortcut: 'Cmd+O' }],
    },
  },
  beforeEach: (context) => {
    // The SDK fake supplies file contents but has no project directory fixture yet.
    const { api } = getStoryScenario(context).plugin
    api.fs.readDir = fn(async ({ projectId, path }) => {
      if (projectId !== project.id || path !== null) throw new Error('Undeclared smoke directory request')
      return [createFileEntry({ name: 'smoke.txt', path: 'smoke.txt' })]
    })
    api.fs.readFile = fn(api.fs.readFile)
  },
  render: (_args, context) => {
    const plugin = getStoryScenario(context).plugin
    return { Component: FilesViewComponent, props: {
      api: plugin.api, context: plugin.context, projectId: project.id, projectName: project.name,
    } }
  },
  play: async (context) => {
    const canvas = within(context.canvasElement)
    const { api } = getStoryScenario(context).plugin
    await expect(canvas.queryByText('Foundation smoke file contents.')).not.toBeInTheDocument()
    await userEvent.click(await canvas.findByRole('treeitem', { name: /smoke.txt/ }))
    await expect(canvas.findByText('Foundation smoke file contents.')).resolves.toBeVisible()
    await expect(api.fs.readDir).toHaveBeenCalledWith({ projectId: project.id, path: null })
    await expect(api.fs.readFile).toHaveBeenCalledOnce()
    await expect(api.fs.readFile).toHaveBeenCalledWith({ projectId: project.id, path: 'smoke.txt' })
  },
}
// Placeholder layout checks only, not bundled-plugin contribution coverage.
export const TaskPane: StoryObj<typeof meta> = {
  name: 'Task pane layout placeholder',
  decorators: [() => ({ Component: TaskPaneFrame, props: { tab: {
    pluginId: 'com.openforge.storybook', contributionId: 'example-tab',
    namespacedId: 'com.openforge.storybook:example-tab', title: 'Example',
    icon: 'sparkles', order: 50, requiresWorkspace: false,
  } } })],
}
export const Settings: StoryObj<typeof meta> = {
  name: 'Settings layout placeholder',
  decorators: [() => ({ Component: SettingsFrame, props: { title: 'Example settings' } })],
}
export const RowAction: StoryObj<typeof meta> = {
  name: 'Row action layout placeholder',
  render: () => ({ Component: ContextMenuItem, props: { label: 'Example row action', onclick: fn() } }),
  decorators: [() => ({ Component: RowActionFrame, props: { task } })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.findByRole('menuitem', { name: 'Example row action' })).resolves.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('menuitem')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /Implement Storybook coverage/ }))
    await expect(canvas.findByRole('menuitem', { name: 'Example row action' })).resolves.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('menuitem')).not.toBeInTheDocument()
  },
}
export const Status: StoryObj<typeof meta> = {
  name: 'Status layout placeholder',
  decorators: [() => ({ Component: StatusFrame, props: { task } })],
}

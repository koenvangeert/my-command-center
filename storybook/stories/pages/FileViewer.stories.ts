import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, within } from 'storybook/test'
import FileViewerPage from '../../shared/frames/FileViewerPage.svelte'
import { fileViewerScenario } from '../../shared/fixtures/fileViewerScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Pages/File Viewer',
  component: FileViewerPage,
  parameters: { openforge: fileViewerScenario() },
  render: (args, context) => {
    const { plugin } = getStoryScenario(context)
    return { Component: FileViewerPage, props: { ...args, api: plugin.api, context: plugin.context } }
  },
} satisfies Meta<typeof FileViewerPage>
export default meta
type Story = StoryObj<{ taskPane?: boolean; noProject?: boolean }>

export const Populated: Story = {}
export const Empty: Story = { parameters: { openforge: fileViewerScenario('empty') } }
export const Loading: Story = { parameters: { openforge: fileViewerScenario('loading') } }
export const Failure: Story = { parameters: { openforge: fileViewerScenario('failure') } }
export const NoProject: Story = { args: { noProject: true } }
export const Markdown: Story = { parameters: { openforge: fileViewerScenario('populated', 'README.md') } }
export const Source: Story = { parameters: { openforge: fileViewerScenario('populated', 'src/main.ts') } }
export const Image: Story = { parameters: { openforge: fileViewerScenario('populated', 'diagram.svg') } }
export const Video: Story = { parameters: { openforge: fileViewerScenario('populated', 'demo.webm') } }
export const VideoUnavailable: Story = { parameters: { openforge: fileViewerScenario('populated', 'unsupported.webm') } }
export const Binary: Story = { parameters: { openforge: fileViewerScenario('populated', 'archive.bin') } }
export const Document: Story = { parameters: { openforge: fileViewerScenario('populated', 'guide.pdf') } }
export const LargeFile: Story = { parameters: { openforge: fileViewerScenario('populated', 'large.log') } }
export const EmptyFile: Story = { parameters: { openforge: fileViewerScenario('populated', 'empty.txt') } }
export const FileLoading: Story = { parameters: { openforge: fileViewerScenario('file-loading', 'README.md') } }
export const FileFailure: Story = { parameters: { openforge: fileViewerScenario('file-failure', 'README.md') } }
export const Narrow: Story = { parameters: { openforge: fileViewerScenario('populated', 'README.md') }, globals: { viewport: { value: 'narrow', isRotated: false } } }
export const Overflow: Story = { parameters: { openforge: fileViewerScenario('overflow', 'long-lines.txt') } }
export const TaskPane: Story = { args: { taskPane: true } }
export const TaskMarkdown: Story = { args: { taskPane: true }, parameters: { openforge: fileViewerScenario('populated', 'README.md') } }
export const TaskEmpty: Story = { args: { taskPane: true }, parameters: { openforge: fileViewerScenario('empty') } }
export const TaskLoading: Story = { args: { taskPane: true }, parameters: { openforge: fileViewerScenario('loading') } }
export const TaskUnavailable: Story = { args: { taskPane: true }, parameters: { openforge: fileViewerScenario('unavailable') } }
export const TaskNarrow: Story = { args: { taskPane: true }, parameters: { openforge: fileViewerScenario('overflow', 'long-lines.txt') }, globals: { viewport: { value: 'narrow', isRotated: false } } }

export const Navigate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('treeitem', { name: 'src/' }))
    await userEvent.click(await canvas.findByRole('treeitem', { name: /^main\.ts/ }))
    await expect(canvas.findByRole('region', { name: 'File text content' })).resolves.toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Return focus to selected file in tree' }))
    await expect(canvas.getByRole('treeitem', { name: /^main\.ts/ })).toHaveFocus()
    await userEvent.click(canvas.getByRole('treeitem', { name: /^README\.md/ }))
    await userEvent.click(await canvas.findByRole('link', { name: 'Open source' }))
    await expect(canvas.findByRole('region', { name: 'File text content' })).resolves.toBeVisible()
  },
}
export const TaskNavigate: Story = { args: { taskPane: true }, play: Navigate.play }
export const RetryRoot: Story = {
  parameters: { openforge: fileViewerScenario('failure') },
  play: async context => {
    const canvas = within(context.canvasElement)
    const retry = await canvas.findByRole('button', { name: 'Retry loading project files' })
    getStoryScenario(context).plugin.releaseFilesystem('directory:')
    await userEvent.click(retry)
    await expect(canvas.findByRole('treeitem', { name: /^README\.md/ })).resolves.toBeVisible()
  },
}
export const FinishLoading: Story = {
  parameters: { openforge: fileViewerScenario('loading') },
  play: async context => {
    const canvas = within(context.canvasElement)
    await expect(canvas.findByText('Loading project files…')).resolves.toBeVisible()
    getStoryScenario(context).plugin.releaseFilesystem('directory:')
    await expect(canvas.findByRole('treeitem', { name: /^README\.md/ })).resolves.toBeVisible()
  },
}
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('searchbox', { name: 'Search files' }), 'main')
    await userEvent.click(await canvas.findByRole('treeitem', { name: /^main\.ts/ }))
    await expect(canvas.findByRole('region', { name: 'File text content' })).resolves.toBeVisible()
  },
}
export const SearchLoading: Story = {
  parameters: { openforge: fileViewerScenario('search-loading') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('searchbox', { name: 'Search files' }), 'main')
    await expect(canvas.findByText('Searching…')).resolves.toBeVisible()
  },
}
export const SearchFailure: Story = {
  parameters: { openforge: fileViewerScenario('search-failure') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(await canvas.findByRole('searchbox', { name: 'Search files' }), 'main')
    await expect(canvas.findByText('File search failed')).resolves.toBeVisible()
  },
}
export const DirectoryFailure: Story = {
  parameters: { openforge: fileViewerScenario('directory-failure') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('treeitem', { name: 'src/' }))
    await expect(canvas.findByText('Unable to load directory src')).resolves.toBeVisible()
  },
}

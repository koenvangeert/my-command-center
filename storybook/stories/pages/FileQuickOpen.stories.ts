import type { NavigationStory as Story } from '../../shared/navigationStories'
import { expect, userEvent, waitFor } from 'storybook/test'
import { get } from 'svelte/store'
import { currentView } from '../../../src/lib/stores'
import { FILE_VIEWER_VIEW_KEY } from '../../../src/lib/fileViewerView'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'
import { navigationMeta, navigationState, dialogQueries, dismissAndReopen, reopenWorkflow, markNavigationReady, type NavigationPlayContext } from '../../shared/navigationStories'

async function search(context: NavigationPlayContext, query = 'ts') {
  const body = dialogQueries(context)
  await userEvent.type(await body.findByPlaceholderText('Search files...'), query)
  await waitFor(() => expect(getStoryScenario(context).desktop.calls).toContainEqual({
    command: 'fs_search_files', payload: { projectId: 'project-1', query, limit: 50 },
  }))
  return body
}
const meta = { ...navigationMeta('files', 'Pages/File quick-open'), title: 'Pages/File quick-open' }
export default meta

export const Initial: Story = {}
export const Populated: Story = {
  play: async (context) => {
    const body = await search(context)
    await body.findByRole('option', { name: /navigation.ts/ })
    await expect(body.getAllByRole('option')).toHaveLength(2)
    markNavigationReady(context)
  },
}
export const Empty: Story = {
  ...navigationState('files', 'empty'),
  play: async (context) => {
    const body = await search(context)
    await body.findByText('No files match your search')
    markNavigationReady(context)
  },
}
export const Loading: Story = {
  ...navigationState('files', 'loading'),
  play: async (context) => {
    const body = await search(context)
    await body.findByText('Searching...')
    markNavigationReady(context)
  },
}
export const Failure: Story = {
  ...navigationState('files', 'failure'),
  play: async (context) => {
    const body = await search(context)
    await body.findByText('No files match your search')
    markNavigationReady(context)
  },
}
export const Unavailable: Story = navigationState('files', 'unavailable')
export const Narrow: Story = { ...Populated, globals: { viewport: { value: 'narrow', isRotated: false } } }
export const Overflow: Story = {
  ...navigationState('files', 'overflow'),
  play: async (context) => {
    const body = await search(context)
    await body.findByText('Showing top 50 results')
    await expect(body.getAllByRole('option')).toHaveLength(50)
    await userEvent.keyboard('{ArrowUp}')
    await expect(body.getByRole('option', { selected: true })).toHaveTextContent('component-49.ts')
    markNavigationReady(context)
  },
}
export const OpenAndReopen: Story = {
  play: async (context) => {
    const body = dialogQueries(context)
    await dismissAndReopen(context, 'Search files...')
    await search(context)
    await body.findByRole('option', { name: /navigation.ts/ })
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await body.findByRole('button', { name: 'Reopen workflow' })
    await expect(getStoryScenario(context).desktop.calls).toContainEqual({
      command: 'set_config', payload: { key: 'catalog.lastCommand', value: '{"id":"revealFile","payload":{"path":"src/search.ts"}}' },
    })
    await expect(get(currentView)).toBe(FILE_VIEWER_VIEW_KEY)
    await reopenWorkflow(context)
    await expect(await body.findByPlaceholderText('Search files...')).toHaveValue('')
    await expect(get(currentView)).toBe('board')
    markNavigationReady(context)
  },
}
export const FinishLoading: Story = {
  ...navigationState('files', 'loading'),
  play: async (context) => {
    const body = await search(context)
    await body.findByText('Searching...')
    getStoryScenario(context).desktop.release('fs_search_files')
    await body.findByRole('option', { name: /navigation.ts/ })
    markNavigationReady(context)
  },
}

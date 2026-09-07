import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ProjectSidebarList from '../../../src/components/shell/ProjectSidebarList.svelte'
import { chromeScenario } from '../../shared/fixtures/chromeScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Components/Host Chrome/Project List', component: ProjectSidebarList,
  parameters: { openforge: chromeScenario() },
  args: { collapsed: false, projectContextActive: true, onSelectProject: fn(), onNewProject: fn() },
} satisfies Meta<typeof ProjectSidebarList>
export default meta
type Story = StoryObj<typeof meta>
export const Expanded: Story = {}
export const Collapsed: Story = { args: { collapsed: true } }
export const NoSelection: Story = { args: { projectContextActive: false } }
export const HiddenProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Hidden (1)' }))
    await expect(canvas.getByText('Archived experiments')).toBeVisible()
  },
}
export const SavingOrder: Story = {
  play: async (context) => {
    const canvas = within(context.canvasElement)
    getStoryScenario(context).desktop.defer('set_config')
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Move OpenForge down' }))
      await expect(canvas.getByRole('button', { name: 'Move OpenForge up' })).toBeDisabled()
    } finally {
      getStoryScenario(context).desktop.release('set_config')
    }
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Move OpenForge up' })).toBeEnabled())
  },
}

import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import AppSidebar from '../../../src/components/shell/AppSidebar.svelte'
import { chromeScenario } from '../../shared/fixtures/chromeScenario'

const meta = {
  title: 'Components/Host Chrome/Sidebar',
  component: AppSidebar,
  parameters: { openforge: chromeScenario(), layout: 'fullscreen' },
  args: {
    collapsed: false, currentView: 'board', appMode: 'production',
    onToggleCollapse: fn(), onNavigate: fn(), onSelectProject: fn(), onNewProject: fn(), onOpenAttentionOverview: fn(),
    pluginNavItems: [{ viewKey: 'plugin:example:reviews', title: 'All pull requests', icon: 'git-pull-request', shortcut: null }],
  },
} satisfies Meta<typeof AppSidebar>
export default meta
type Story = StoryObj<typeof meta>
export const Expanded: Story = {}
export const Collapsed: Story = { args: { collapsed: true } }
export const GlobalSelected: Story = { args: { currentView: 'global_settings' } }
export const PluginSelected: Story = { args: { currentView: 'plugin:example:reviews' } }
export const Development: Story = { args: { appMode: 'dev' }, parameters: { openforge: { ...chromeScenario(), desktop: { responses: { get_git_branch: 'feature/shared-host-chrome-with-a-long-branch-name' } } } } }
export const SelectProject: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Documentation and contributor onboarding' }))
    await expect(args.onSelectProject).toHaveBeenCalledWith('P-2')
  },
}

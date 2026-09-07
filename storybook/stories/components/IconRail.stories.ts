import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import IconRail from '../../../src/components/shell/IconRail.svelte'
import { commandHeld } from '../../../src/lib/stores'
import { createStoryStoreAdapter } from '../../shared/environment/storyStoreAdapter'

const meta = {
  title: 'Components/Host Chrome/Project Tools',
  component: IconRail,
  args: { currentView: 'board', onNavigate: fn(), activeProjectAttentionCount: 3,
    pluginNavItems: [{ viewKey: 'plugin:example:files', title: 'Repository files', icon: 'files', shortcut: '⌘E' }],
  },
  parameters: { openforge: { adapters: () => [createStoryStoreAdapter(commandHeld, false)] } },
} satisfies Meta<typeof IconRail>
export default meta
type Story = StoryObj<typeof meta>
export const Selected: Story = {}
export const PluginSelected: Story = { args: { currentView: 'plugin:example:files' } }
export const Shortcuts: Story = { parameters: { openforge: { adapters: () => [createStoryStoreAdapter(commandHeld, true)] } } }
export const ModalSuppressesShortcuts: Story = { ...Shortcuts, args: { modalsOpen: true } }
export const Navigate: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Repository files' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('plugin:example:files')
  },
}

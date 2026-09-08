import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, within, waitFor } from 'storybook/test'
import TerminalTabs from '../../../plugins/terminal/src/TerminalTabs.svelte'
import { terminalScenario } from '../../shared/fixtures/terminalScenario'
import { terminalProgress, terminalReady } from '../../shared/fixtures/terminalReadiness'

const meta = {
  title: 'Components/Terminal Tabs',
  component: TerminalTabs,
  args: { taskId: 'T-42', workspacePath: '/projects/openforge', onTabChange: null, onTabCountChange: null },
  parameters: { openforge: terminalScenario() },
} satisfies Meta<typeof TerminalTabs>
export default meta
type Story = StoryObj<typeof meta>
export const Ready: Story = { play: context => terminalReady(context) }
export const Overflow: Story = {
  play: async context => {
    const canvas = within(context.canvasElement)
    terminalProgress(context, 'initial-tab')
    await waitFor(() => expect(canvas.getAllByRole('tab')).toHaveLength(1))
    for (let i = 1; i < 12; i++) {
      terminalProgress(context, 'open-tab', { tab: i + 1 })
      await userEvent.click(canvas.getByRole('button', { name: 'Open new shell' }))
    }
    await expect(canvas.getAllByRole('tab')).toHaveLength(12)
    terminalProgress(context, 'select-first-tab')
    await userEvent.click(canvas.getAllByRole('tab')[0])
    await expect(canvas.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
    await terminalReady(context)
  },
}

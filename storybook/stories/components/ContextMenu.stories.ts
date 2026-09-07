import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ContextMenuFixture from '../../shared/ContextMenuFixture.svelte'

const meta = { title: 'Components/Host Controls/Context Menu', component: ContextMenuFixture, args: { onselect: fn() } } satisfies Meta<typeof ContextMenuFixture>
export default meta
type Story = StoryObj<typeof meta>
export const Closed: Story = {}
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open actions' }))
    await expect(canvas.getByRole('menu')).toBeVisible()
    await expect(canvas.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
  },
}
export const KeyboardSelection: Story = {
  play: async (context) => {
    await Open.play!(context)
    const canvas = within(context.canvasElement)
    await expect(canvas.getByRole('menuitem', { name: 'Open project' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('menuitem', { name: 'Copy repository path' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(context.args.onselect).toHaveBeenCalledWith('copy')
    await expect(canvas.queryByRole('menu')).not.toBeInTheDocument()
  },
}
export const RepeatOpenClose: Story = {
  play: async (context) => {
    for (let repeat = 0; repeat < 2; repeat++) {
      await Open.play!(context)
      await userEvent.keyboard('{Escape}')
      await expect(within(context.canvasElement).queryByRole('menu')).not.toBeInTheDocument()
      await expect(within(context.canvasElement).getByRole('button', { name: 'Open actions' })).toHaveFocus()
    }
  },
}

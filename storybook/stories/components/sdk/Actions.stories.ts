import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import Actions from './Actions.svelte'
import { narrowViewport } from './narrowViewport'

const meta = {
  title: 'Components/Plugin SDK/Actions',
  component: Actions,
  args: { onAction: fn() },
} satisfies Meta<typeof Actions>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Disabled: Story = {
  args: { state: 'disabled' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create task' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }))
    await expect(args.onAction).not.toHaveBeenCalled()
  },
}
export const Loading: Story = { args: { state: 'loading' } }
export const NarrowOverflow: Story = { ...narrowViewport, args: { state: 'overflow' } }
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('button', { name: 'Create task' }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onAction).toHaveBeenLastCalledWith('create')
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await expect(args.onAction).toHaveBeenLastCalledWith('refresh')
  },
}

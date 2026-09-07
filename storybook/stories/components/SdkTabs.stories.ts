import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { createRawSnippet } from 'svelte'
import { expect, fn, userEvent, within } from 'storybook/test'
import Tabs from '@openforge-app/plugin-sdk/ui/Tabs.svelte'

const meta = {
  title: 'SDK/Tabs', component: Tabs,
  args: {
    label: 'Report sections', value: 'summary', onValueChange: fn(),
    tabs: [{ value: 'summary', label: 'Summary' }, { value: 'sync', label: 'Sync', disabled: true }, { value: 'history', label: 'History' }],
    children: createRawSnippet((value) => ({ render: () => `<p>${value() === 'summary' ? 'Latest report is ready for review.' : 'Two reports were published this week.'}</p>` })),
  },
} satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>
export const Horizontal: Story = {}
export const Vertical: Story = { args: { orientation: 'vertical' } }
export const Disabled: Story = { args: { disabled: true } }
export const AutomaticKeyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: 'Summary' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveFocus()
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
    await expect(args.onValueChange).toHaveBeenCalledWith('history')
    await userEvent.keyboard('{Home}')
    await expect(canvas.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true')
  },
}
export const ManualVertical: Story = {
  args: { orientation: 'vertical', activationMode: 'manual' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: 'Summary' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(canvas.getByRole('tab', { name: 'History' })).toHaveFocus()
    await expect(canvas.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Two reports')
  },
}

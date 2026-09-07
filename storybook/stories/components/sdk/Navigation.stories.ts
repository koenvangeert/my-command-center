import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import Navigation from './Navigation.svelte'
import { narrowViewport } from './narrowViewport'

const meta = {
  title: 'Components/Plugin SDK/Navigation', component: Navigation,
  args: { onActivate: fn() },
} satisfies Meta<typeof Navigation>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { state: 'selected' } }
export const Collapsed: Story = { args: { state: 'collapsed' } }
export const NarrowOverflow: Story = { ...narrowViewport, args: { state: 'overflow' } }
export const Keyboard: Story = {
  args: { state: 'collapsed' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Project files' })
    await expect(button).toHaveAttribute('aria-current', 'page')
    button.focus()
    await userEvent.keyboard('{Enter} ')
    await expect(args.onActivate).toHaveBeenCalledTimes(2)
  },
}

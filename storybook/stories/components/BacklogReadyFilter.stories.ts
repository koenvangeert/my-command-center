import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import BacklogReadyFilterToggle from '../../../src/components/focus-board/BacklogReadyFilterToggle.svelte'
const meta = {
  title: 'Components/Board/Ready Filter', component: BacklogReadyFilterToggle,
  args: { active: false, readyCount: 3, onToggle: fn() },
} satisfies Meta<typeof BacklogReadyFilterToggle>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Active: Story = { args: { active: true } }
export const Empty: Story = { args: { readyCount: 0 } }
export const Toggle: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button'))
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
  },
}

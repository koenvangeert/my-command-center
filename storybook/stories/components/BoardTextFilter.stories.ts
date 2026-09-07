import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import BoardTextFilter from '../../../src/components/focus-board/BoardTextFilter.svelte'
const meta = {
  title: 'Components/Board/Text Filter', component: BoardTextFilter,
  args: { query: '', matchingCount: 3, shortcutBlocked: false, onBoardKeydown: fn() },
} satisfies Meta<typeof BoardTextFilter>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Filtered: Story = { args: { query: 'keyboard', matchingCount: 1 } }
export const NoMatches: Story = { args: { query: 'missing task', matchingCount: 0 } }
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.keyboard('/')
    await userEvent.type(within(canvasElement).getByRole('searchbox'), 'keyboard')
    await expect(within(canvasElement).getByRole('searchbox')).toHaveValue('keyboard')
  },
}

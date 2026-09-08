import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import BacklogLabelFilterDropdown from '../../../src/components/focus-board/BacklogLabelFilterDropdown.svelte'

const labels = [
  { id: 1, projectId: 'project-1', name: 'accessibility' },
  { id: 2, projectId: 'project-1', name: 'release-blocker' },
]
const meta = {
  title: 'Components/Board/Label Filter', component: BacklogLabelFilterDropdown,
  args: { labels, labelCounts: new Map([[1, 3], [2, 1]]), selectedLabelIds: new Set<number>(), onToggle: fn() },
} satisfies Meta<typeof BacklogLabelFilterDropdown>
export default meta
type Story = StoryObj<typeof meta>
async function openMenu(canvasElement: HTMLElement) {
  const trigger = within(canvasElement).getByRole('button', { name: 'Filter by Task Labels' })
  // Bits UI releases the previous menu's document pointer lock after unmount.
  await waitFor(() => expect(getComputedStyle(trigger).pointerEvents).not.toBe('none'))
  await userEvent.click(trigger)
}
export const Default: Story = {}
export const Empty: Story = { args: { labels: [] } }
export const Selected: Story = { args: { selectedLabelIds: new Set([1]) } }
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await openMenu(canvasElement)
    await expect(within(canvasElement.ownerDocument.body).findByRole('menuitemcheckbox', { name: /accessibility/ })).resolves.toBeVisible()
  },
}
export const Toggle: Story = {
  play: async ({ canvasElement, args }) => {
    await openMenu(canvasElement)
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole('menuitemcheckbox', { name: /accessibility/ }))
    await expect(args.onToggle).toHaveBeenCalledWith(1)
  },
}

import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SourceTicketLink from '../../../src/components/task-detail/SourceTicketLink.svelte'
const meta = { title: 'Components/Task Workspace/Source Ticket', component: SourceTicketLink,
  args: { url: null, onSave: fn() } } satisfies Meta<typeof SourceTicketLink>
export default meta
type Story = StoryObj<typeof meta>
export const Empty: Story = {}
export const Linked: Story = { args: { url: 'https://github.com/openforge/openforge/issues/42' } }
export const ReadOnly: Story = { args: { url: 'https://github.com/openforge/openforge/issues/42', onSave: undefined } }
export const LongContent: Story = { args: { url: 'https://issues.example.com/projects/openforge/issues/very-long-integration-regression-with-keyboard-navigation-and-focus-management' } }
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Add.*ticket/i }))
    await expect(within(canvasElement).getByRole('textbox')).toBeVisible()
  },
}

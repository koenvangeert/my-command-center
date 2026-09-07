import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ToastFixture from '../../shared/ToastFixture.svelte'

const meta = {
  title: 'Components/Feedback/Toast', component: ToastFixture,
  args: { ondismiss: fn(), onactivate: fn() },
} satisfies Meta<typeof ToastFixture>
export default meta
type Story = StoryObj<typeof meta>
export const Success: Story = {}
export const Warning: Story = { args: { variant: 'warning', message: 'GitHub API rate limited\nResets in 2 min', position: 'raised' } }
export const Error: Story = { args: { variant: 'error', message: 'Could not save project settings. Your changes have not been saved.' } }
export const LongContent: Story = { args: { variant: 'error', message: 'Could not open /workspace/contributor-onboarding/repositories/a-project-with-a-very-long-name/settings.json.\nCheck that the repository is still available and try again.' } }
export const Activate: Story = {
  args: { actionable: true, message: 'Agent needs input on OF-42', variant: 'warning' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Agent needs input on OF-42' }))
    await expect(args.onactivate).toHaveBeenCalledOnce()
    await expect(args.ondismiss).toHaveBeenCalledOnce()
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
  },
}
export const RepeatDismiss: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    for (let repeat = 0; repeat < 2; repeat++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Dismiss notification' }))
      await expect(canvas.queryByRole('status')).not.toBeInTheDocument()
      await userEvent.click(canvas.getByRole('button', { name: 'Show notification' }))
      await expect(canvas.getByRole('status')).toBeVisible()
    }
    await expect(args.ondismiss).toHaveBeenCalledTimes(2)
  },
}
export const AutoDismiss: Story = {
  args: { timeout: 200 },
  play: async ({ canvasElement, args }) => {
    await waitFor(() => expect(args.ondismiss).toHaveBeenCalledOnce())
    await expect(within(canvasElement).queryByRole('status')).not.toBeInTheDocument()
  },
}

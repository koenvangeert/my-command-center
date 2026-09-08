import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import AttentionOverviewDialog from '../../../src/components/attention/AttentionOverviewDialog.svelte'
import { attentionScenario } from '../../shared/fixtures/attentionScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Pages/Attention Overview',
  component: AttentionOverviewDialog,
  parameters: { openforge: attentionScenario() },
  args: { onClose: fn(), onOpenTask: fn(), onOpenPr: fn() },
} satisfies Meta<typeof AttentionOverviewDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}
export const Empty: Story = { parameters: { openforge: attentionScenario('empty') } }
export const Loading: Story = { parameters: { openforge: attentionScenario('loading') } }
export const Failure: Story = { parameters: { openforge: attentionScenario('failure') } }
export const LongContent: Story = { parameters: { openforge: attentionScenario('long-content') } }
export const Narrow: Story = { globals: { viewport: { value: 'narrow', isRotated: false } } }
export const OpenTask: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Attention overview' }))
    await userEvent.click(await dialog.findByText('Normalize the greeting'))
    await expect(args.onOpenTask).toHaveBeenCalledWith({ id: 'T-42', projectId: 'project-1' })
  },
}
export const OpenReview: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByText('Review keyboard navigation'))
    await expect(args.onOpenPr).toHaveBeenCalledWith(expect.objectContaining({ number: 51 }), null)
  },
}
export const ReviewsHidden: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.findByText('Review keyboard navigation')).resolves.toBeVisible()
    await userEvent.keyboard('r')
    await expect(body.queryByText('Review keyboard navigation')).not.toBeInTheDocument()
  },
}
export const InFlight: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Attention overview' }))
    await expect(dialog.findByText('Normalize the greeting')).resolves.toBeVisible()
    await userEvent.keyboard('t')
    await expect(dialog.findByText('Build keyboard navigation')).resolves.toBeVisible()
  },
}
export const FinishLoading: Story = {
  parameters: { openforge: attentionScenario('loading') },
  play: async (context) => {
    getStoryScenario(context).desktop.release('get_task_lanes')
    await expect(within(context.canvasElement.ownerDocument.body).findByText('Normalize the greeting')).resolves.toBeVisible()
  },
}
export const RetryFailure: Story = {
  parameters: { openforge: attentionScenario('failure') },
  play: async (context) => {
    const body = within(context.canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: 'Retry' }))
    await expect(getStoryScenario(context).desktop.calls.filter(call => call.command === 'get_task_lanes')).toHaveLength(2)
    await expect(body.getByRole('alert')).toBeVisible()
  },
}
export const Collapsed: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.findByText('Normalize the greeting')).resolves.toBeVisible()
    await userEvent.click(body.getByText('OpenForge'))
    await expect(body.queryByText('Normalize the greeting')).not.toBeInTheDocument()
  },
}

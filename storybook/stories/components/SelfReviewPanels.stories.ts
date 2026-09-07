import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SelfReviewPanels from '../../shared/frames/SelfReviewPanels.svelte'
import { taskDetailScenario, type SelfReviewScenario } from '../../shared/fixtures/taskDetailScenario'
const meta = {
  title: 'Components/Self Review/Panels', component: SelfReviewPanels,
  args: { panel: 'files', onSendToAgent: fn() },
  parameters: { openforge: taskDetailScenario('review').environment },
} satisfies Meta<typeof SelfReviewPanels>
export default meta
type Story = StoryObj<typeof meta>
function scenario(panel: 'files' | 'diff' | 'feedback', state: SelfReviewScenario = 'populated'): Story {
  return { args: { panel }, parameters: { openforge: taskDetailScenario('review', state).environment } }
}
export const ChangedFiles: Story = scenario('files')
export const ChangedFilesEmpty: Story = scenario('files', 'empty')
export const ChangedFilesLong: Story = scenario('files', 'long-content')
export const Diff: Story = scenario('diff')
export const DiffEmpty: Story = scenario('diff', 'empty')
export const DiffLoading: Story = scenario('diff', 'loading')
export const DiffFailure: Story = scenario('diff', 'failure')
export const Feedback: Story = scenario('feedback')
export const FeedbackEmpty: Story = scenario('feedback', 'empty')
export const FeedbackAgentBusy: Story = { ...scenario('feedback'), args: { panel: 'feedback', agentStatus: 'running' } }
export const SendFeedback: Story = {
  ...scenario('feedback'),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Send to agent' }))
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Review the prompt before sending to the agent' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Send to agent' }))
    await expect(args.onSendToAgent).toHaveBeenCalledWith(expect.stringContaining('Please cover the empty-name case too.'))
  },
}

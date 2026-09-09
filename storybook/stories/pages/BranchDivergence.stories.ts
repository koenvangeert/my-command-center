import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import BranchDivergencePage from '../../shared/frames/BranchDivergencePage.svelte'
import { branchDivergenceRequest } from '../../../src/lib/branchDivergenceModalStore'
import { boardScenario } from '../../shared/fixtures/boardScenario'
import { createStoryStoreAdapter } from '../../shared/environment/storyStoreAdapter'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Pages/Branch Divergence', component: BranchDivergencePage,
  args: { onChoice: fn(), reset: async () => {} },
  parameters: { openforge: { adapters: () => [...(boardScenario().adapters?.() ?? []), createStoryStoreAdapter(branchDivergenceRequest, null)] } },
  render: (args, context) => ({ Component: BranchDivergencePage, props: { ...args, reset: () => getStoryScenario(context).environment.reset() } }),
  beforeEach: (context) => {
    delete context.canvasElement.ownerDocument.body.dataset.creationReady
    return () => { delete context.canvasElement.ownerDocument.body.dataset.creationReady }
  },
  play: async ({ canvasElement, id }) => {
    await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Resolve branch divergence' })
    canvasElement.ownerDocument.body.dataset.creationReady = id
  },
} satisfies Meta<typeof BranchDivergencePage>
export default meta
type Story = StoryObj<typeof BranchDivergencePage>
export const Diverged: Story = {}
export const StaleComparison: Story = { args: { stale: true } }
export const LongContent: Story = { args: { longContent: true } }
export const Narrow: Story = { globals: { viewport: { value: 'narrow', isRotated: false } } }
function choose(label: string, choice: 'keepLocal' | 'resetToRemote' | 'cancel'): Story {
  return { play: async ({ canvasElement, args, id }) => {
    const body = within(canvasElement.ownerDocument.body)
    for (let attempt = 0; attempt < 2; attempt++) {
      await userEvent.click(await body.findByRole('button', { name: label }))
      await waitFor(() => expect(args.onChoice).toHaveBeenLastCalledWith(choice))
      const reopen = await body.findByRole('button', { name: 'Reopen workflow' })
      await waitFor(() => expect(getComputedStyle(reopen).pointerEvents).not.toBe('none'))
      await userEvent.click(reopen)
      await body.findByRole('dialog', { name: 'Resolve branch divergence' })
    }
    canvasElement.ownerDocument.body.dataset.creationReady = id
  } }
}
export const KeepLocal: Story = choose('Keep local', 'keepLocal')
export const ResetToRemote: Story = choose('Reset to remote', 'resetToRemote')
export const Cancel: Story = choose('Cancel', 'cancel')

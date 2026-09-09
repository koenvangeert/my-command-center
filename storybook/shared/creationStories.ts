import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import CreationWorkflow from './frames/CreationWorkflow.svelte'
import { creationScenario, type CreationWorkflowKind } from './fixtures/creationScenario'
import { getStoryScenario } from './storyEnvironmentPreview'

export type CreationStory = StoryObj<typeof CreationWorkflow>
export type CreationContext = Parameters<NonNullable<CreationStory['play']>>[0]
export const creationQueries = (context: CreationContext) => within(context.canvasElement.ownerDocument.body)
export function creationReady(context: CreationContext) { context.canvasElement.ownerDocument.body.dataset.creationReady = context.id }
export function creationState(workflow: CreationWorkflowKind, state: string) {
  return { args: { state }, parameters: { openforge: creationScenario(workflow, state) } }
}
export function creationMeta(workflow: CreationWorkflowKind, title: string) {
  return {
    title, component: CreationWorkflow,
    args: { workflow, state: 'default', reset: async () => {}, onClose: fn(), onTaskCreated: fn(), onTaskSaved: fn(), onProjectCreated: fn() },
    parameters: { openforge: creationScenario(workflow) },
    argTypes: { reset: { table: { disable: true } }, workflow: { control: false }, state: { control: false } },
    render: (args, context) => ({ Component: CreationWorkflow, props: { ...args, reset: () => getStoryScenario(context).environment.reset() } }),
    beforeEach: (context) => {
      delete context.canvasElement.ownerDocument.body.dataset.creationReady
      return () => { delete context.canvasElement.ownerDocument.body.dataset.creationReady }
    },
    play: async (context) => {
      await creationQueries(context).findByRole('dialog')
      if (workflow === 'task') await waitFor(() => expect(creationQueries(context).queryByText('Loading task defaults…')).not.toBeInTheDocument())
      creationReady(context)
    },
  } satisfies Meta<typeof CreationWorkflow>
}
export async function reopenCreation(context: CreationContext) {
  const button = await creationQueries(context).findByRole('button', { name: 'Reopen workflow' })
  await waitFor(() => expect(getComputedStyle(button).pointerEvents).not.toBe('none'))
  await userEvent.click(button)
  await creationQueries(context).findByRole('dialog')
}
export async function taskReady(context: CreationContext) {
  await waitFor(() => expect(creationQueries(context).queryByText('Loading task defaults…')).not.toBeInTheDocument())
}

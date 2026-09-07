import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import TaskInspectorPanel from '../../../src/components/task-detail/TaskInspectorPanel.svelte'
import { taskDetailScenario, type TaskDetailScenario } from '../../shared/fixtures/taskDetailScenario'
import WorkspaceComponentFrame from '../../shared/frames/WorkspaceComponentFrame.svelte'
const meta = {
  title: 'Components/Task Workspace/Inspector', component: TaskInspectorPanel,
  decorators: [() => ({ Component: WorkspaceComponentFrame })],
  args: { task: null, onOpenFullView: fn(), onOpenLinkedTask: fn(), onEditTask: fn() },
} satisfies Meta<typeof TaskInspectorPanel>
export default meta
type Story = StoryObj<typeof meta>
function scenario(kind: TaskDetailScenario): Story {
  const { task, environment, hostLifecycle } = taskDetailScenario(kind)
  return { args: { task, workspacePath: hostLifecycle.workspacePath }, parameters: { openforge: environment } }
}
export const Empty: Story = {}
export const Backlog: Story = scenario('backlog')
export const Active: Story = scenario('active')
export const Completed: Story = scenario('completed')
export const Dependency: Story = {
  ...scenario('dependency'),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(await within(canvasElement).findByText('Define the greeting API'))
    await expect(args.onOpenLinkedTask).toHaveBeenCalledWith('T-41', 'project-1')
  },
}
export const LongContent: Story = scenario('long-content')
export const OpenFullView: Story = {
  ...scenario('backlog'),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open full view' }))
    await expect(args.onOpenFullView).toHaveBeenCalledTimes(1)
  },
}

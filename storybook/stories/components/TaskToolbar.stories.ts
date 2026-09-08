import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import TaskDetailToolbar from '../../../src/components/task-detail/TaskDetailToolbar.svelte'
import { INITIAL_TASK_RUN_APP_STATE } from '../../../src/components/task-detail/taskRunAppController'
import { taskDetailScenario, type TaskDetailScenario } from '../../shared/fixtures/taskDetailScenario'
const meta = {
  title: 'Components/Task Workspace/Toolbar', component: TaskDetailToolbar,
  args: { task: taskDetailScenario('backlog').task, workspacePath: null, activeView: 'agent', tabs: [],
    runAppState: INITIAL_TASK_RUN_APP_STATE, onRunAction: fn(), onBack: fn(), onSelectView: fn(), onRunApp: fn() },
} satisfies Meta<typeof TaskDetailToolbar>
export default meta
type Story = StoryObj<typeof meta>
function scenario(kind: TaskDetailScenario): Story {
  const { task, environment, hostLifecycle } = taskDetailScenario(kind)
  return { args: { task, workspacePath: hostLifecycle.workspacePath }, parameters: { openforge: environment } }
}
export const Backlog: Story = scenario('backlog')
export const Active: Story = scenario('active')
export const Failed: Story = scenario('failed')
export const Completed: Story = scenario('completed')
export const Unread: Story = { ...scenario('active'), args: { ...scenario('active').args, activeView: 'review', hasUnreadAgentOutput: true } }
export const Dependency: Story = scenario('dependency')
export const StartTask: Story = {
  ...scenario('backlog'),
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start Task' }))
    await expect(args.onRunAction).toHaveBeenCalledWith({ taskId: 'T-42', actionPrompt: '' })
  },
}

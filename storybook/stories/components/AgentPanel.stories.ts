import type { Meta, StoryObj } from '@storybook/svelte-vite'
import AgentPanel from '../../../src/components/task-detail/AgentPanel.svelte'
import { taskDetailScenario, type TaskDetailScenario } from '../../shared/fixtures/taskDetailScenario'
import WorkspaceComponentFrame from '../../shared/frames/WorkspaceComponentFrame.svelte'
const meta = {
  title: 'Components/Task Workspace/Agent Panel', component: AgentPanel,
  decorators: [() => ({ Component: WorkspaceComponentFrame })],
  args: { taskId: 'T-42', isActive: true },
} satisfies Meta<typeof AgentPanel>
export default meta
type Story = StoryObj<typeof meta>
function scenario(kind: TaskDetailScenario): Story { return { parameters: { openforge: taskDetailScenario(kind).environment } } }
export const Empty: Story = scenario('backlog')
export const Starting: Story = { ...scenario('backlog'), args: { isStarting: true } }
export const Active: Story = scenario('active')
export const Waiting: Story = scenario('waiting')
export const Failed: Story = scenario('failed')
export const Completed: Story = scenario('completed')
export const Inactive: Story = { ...scenario('active'), args: { isActive: false } }

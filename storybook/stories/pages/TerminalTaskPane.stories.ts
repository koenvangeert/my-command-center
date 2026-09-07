import type { Meta, StoryObj } from '@storybook/svelte-vite'
import TerminalTaskPane from '../../../plugins/terminal/src/TerminalTaskPane.svelte'
import TaskPaneFrame from '../../shared/frames/TaskPaneFrame.svelte'
import { terminalScenario } from '../../shared/fixtures/terminalScenario'
import { terminalReady } from '../../shared/fixtures/terminalReadiness'

const meta = {
  title: 'Pages/Terminal Task Pane',
  component: TerminalTaskPane,
  decorators: [() => ({ Component: TaskPaneFrame, props: { tab: {
    pluginId: 'com.openforge.terminal', contributionId: 'terminal',
    namespacedId: 'com.openforge.terminal:terminal', title: 'Terminal',
    icon: 'terminal', order: 10, requiresWorkspace: false,
  } } })],
  args: { taskId: 'T-42', taskStatus: 'doing' },
  parameters: { openforge: terminalScenario() },
} satisfies Meta<typeof TerminalTaskPane>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = { play: context => terminalReady(context) }
export const Loading: Story = { parameters: { openforge: terminalScenario({ workspace: 'loading' }) } }
export const MissingWorkspace: Story = { parameters: { openforge: terminalScenario({ workspace: 'missing' }) } }
export const LookupError: Story = { parameters: { openforge: terminalScenario({ workspace: 'error' }) } }
export const Overflow: Story = { parameters: { openforge: terminalScenario({ state: 'overflow' }) } }

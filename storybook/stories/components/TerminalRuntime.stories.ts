import type { Meta, StoryObj } from '@storybook/svelte-vite'
import type { ComponentProps } from 'svelte'
import { expect, waitFor } from 'storybook/test'
import TaskTerminalSurface from '../../../packages/terminal-runtime/src/TaskTerminalSurface.svelte'
import { terminalScenario } from '../../shared/fixtures/terminalScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'
import { terminalReady } from '../../shared/fixtures/terminalReadiness'

const meta = {
  title: 'Components/Terminal Runtime',
  component: TaskTerminalSurface,
  args: { taskId: 'T-42', workspacePath: '/projects/openforge', terminalKey: 'T-42-shell-0', terminalIndex: 0, isActive: true, showShellReadyAffordance: true },
  parameters: { openforge: terminalScenario() },
  render: (args, context) => ({ Component: TaskTerminalSurface, props: { ...args, adapter: getStoryScenario(context).terminal!.surface } }),
} satisfies Meta<typeof TaskTerminalSurface>
export default meta
type Story = StoryObj<Partial<Omit<ComponentProps<typeof TaskTerminalSurface>, 'adapter'>>>
export const Ready: Story = { play: context => terminalReady(context) }
export const Inactive: Story = { args: { isActive: false } }
export const Empty: Story = { parameters: { openforge: terminalScenario({ state: 'empty' }) }, play: context => terminalReady(context, '') }
export const Overflow: Story = { parameters: { openforge: terminalScenario({ state: 'overflow' }) }, play: context => terminalReady(context, 'build 80:') }
export const Reset: Story = {
  play: async context => {
    const scenario = getStoryScenario(context)
    const terminal = scenario.terminal!
    await waitFor(() => expect(terminal.runtime.isPtyActive('T-42-shell-0')).toBe(true))
    const previous = terminal.transport
    await terminal.transport.writeUserInput('T-42-shell-0', 'discard on reset')
    await scenario.environment.reset()
    await waitFor(() => expect(context.canvasElement.querySelector('.xterm-helper-textarea')).not.toBeNull())
    await waitFor(() => expect(terminal.runtime.isPtyActive('T-42-shell-0')).toBe(true))
    expect(previous.resources()).toEqual({ sessions: 0, listeners: 0 })
    expect(terminal.transport.inputs).toEqual([])
  },
}
export const Disconnected: Story = {
  play: async context => {
    const terminal = getStoryScenario(context).terminal!
    await waitFor(() => expect(terminal.runtime.isPtyActive('T-42-shell-0')).toBe(true))
    terminal.transport.exit('T-42-shell-0')
    await terminalReady(context)
  },
}
export const StaleEvents: Story = {
  play: async context => {
    const terminal = getStoryScenario(context).terminal!
    await waitFor(() => expect(terminal.runtime.isPtyActive('T-42-shell-0')).toBe(true))
    const replay = await terminal.transport.readReplay('T-42-shell-0')
    terminal.transport.emit('T-42-shell-0', 'STALE', replay.ptyInstanceId! - 1)
    terminal.transport.exit('T-42-shell-0', replay.ptyInstanceId! - 1)
    expect(terminal.runtime.isPtyActive('T-42-shell-0')).toBe(true)
    terminal.transport.emit('T-42-shell-0', 'current output')
    await waitFor(() => expect(terminal.runtime.diagnostics.observe('T-42-shell-0')?.output.modelSequence).toBe(1))
  },
}

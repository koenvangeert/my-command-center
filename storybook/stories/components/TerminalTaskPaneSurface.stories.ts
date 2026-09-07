import type { Meta, StoryObj } from '@storybook/svelte-vite'
import type { ComponentProps } from 'svelte'
import TerminalTaskPaneSurface from '../../../packages/terminal-runtime/src/TerminalTaskPaneSurface.svelte'
import { terminalScenario } from '../../shared/fixtures/terminalScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Components/Terminal Task Pane Surface',
  component: TerminalTaskPaneSurface,
  args: { taskId: 'T-42', taskStatus: 'doing' },
  parameters: { openforge: terminalScenario() },
  render: (args, context) => ({ Component: TerminalTaskPaneSurface, props: { ...args, adapter: getStoryScenario(context).terminal!.surface } }),
} satisfies Meta<typeof TerminalTaskPaneSurface>
export default meta
type Story = StoryObj<Partial<Omit<ComponentProps<typeof TerminalTaskPaneSurface>, 'adapter'>>>
export const Ready: Story = {}
export const Loading: Story = { parameters: { openforge: terminalScenario({ workspace: 'loading' }) } }
export const MissingWorkspace: Story = { parameters: { openforge: terminalScenario({ workspace: 'missing' }) } }

import type { Meta, StoryObj } from '@storybook/svelte-vite'
import type { ComponentProps } from 'svelte'
import TerminalTabsSurface from '../../../packages/terminal-runtime/src/TerminalTabsSurface.svelte'
import { terminalScenario } from '../../shared/fixtures/terminalScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Components/Terminal Tabs Surface',
  component: TerminalTabsSurface,
  args: { taskId: 'T-42', workspacePath: '/projects/openforge', onTabChange: null, onTabCountChange: null },
  parameters: { openforge: terminalScenario() },
  render: (args, context) => ({ Component: TerminalTabsSurface, props: { ...args, adapter: getStoryScenario(context).terminal!.surface } }),
} satisfies Meta<typeof TerminalTabsSurface>
export default meta
type Story = StoryObj<Partial<Omit<ComponentProps<typeof TerminalTabsSurface>, 'adapter'>>>
export const Ready: Story = {}
export const ShortcutHints: Story = { args: { shortcutHintsVisible: true } }

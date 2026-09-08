import type { Meta, StoryObj } from '@storybook/svelte-vite'
import FocusEmptyState from '../../../src/components/focus-board/FocusEmptyState.svelte'
const meta = { title: 'Components/Board/Empty State', component: FocusEmptyState, args: { filter: 'focus' } } satisfies Meta<typeof FocusEmptyState>
export default meta
type Story = StoryObj<typeof meta>
export const Focus: Story = {}
export const InFlight: Story = { args: { filter: 'in-flight' } }
export const OutOfFocus: Story = { args: { filter: 'out-of-focus' } }
export const Backlog: Story = { args: { filter: 'backlog' } }

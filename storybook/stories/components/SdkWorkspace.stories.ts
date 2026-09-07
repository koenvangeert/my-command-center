import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, within } from 'storybook/test'
import SdkWorkspace from '../../shared/fixtures/SdkWorkspace.svelte'
import ComponentFrame from '../../shared/frames/ComponentFrame.svelte'

const meta = {
  title: 'SDK/File workspace', component: SdkWorkspace,
  decorators: [() => ({ Component: ComponentFrame })],
} satisfies Meta<typeof SdkWorkspace>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const Selected: Story = { args: { initialSelection: 'README.md' } }
export const Empty: Story = { args: { scenario: 'empty' } }
export const Loading: Story = { args: { scenario: 'loading' } }
export const Error: Story = { args: { scenario: 'error' } }
export const Overflow: Story = { args: { scenario: 'overflow' } }
export const RightPanel: Story = { args: { side: 'right', initialSelection: 'src/plugin.ts' } }
export const Retry: Story = {
  args: { scenario: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))
    await expect(canvas.getByRole('tree')).toBeVisible()
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}
export const KeyboardAndResize: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = canvas.getByRole('treeitem', { name: /^src/ })
    root.focus()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(root).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    await expect(canvas.getByRole('treeitem', { name: /index.ts/ })).toHaveAttribute('aria-selected', 'true')
    const handle = canvas.getByRole('separator', { name: 'Resize files panel' })
    handle.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect(handle).toHaveAttribute('aria-valuenow', '260')
    await userEvent.keyboard('{ArrowLeft}{Enter}')
    await expect(handle).toHaveAttribute('aria-valuenow', '240')
  },
}

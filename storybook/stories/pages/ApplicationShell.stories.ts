import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import ChromePage from '../../shared/frames/ChromePage.svelte'
import { chromeScenario } from '../../shared/fixtures/chromeScenario'

const meta = {
  title: 'Application/Shell',
  component: ChromePage,
  parameters: { openforge: chromeScenario() },
} satisfies Meta<typeof ChromePage>
export default meta

type Story = StoryObj<typeof meta>
export const Expanded: Story = {}
export const Collapsed: Story = { args: { initiallyCollapsed: true } }
export const Zen: Story = { args: { zen: true } }
export const GlobalView: Story = { args: { global: true } }
export const Narrow: Story = { args: { initiallyCollapsed: true, longContent: true }, globals: { viewport: { value: 'narrow', isRotated: false } } }
export const Shortcuts: Story = { args: { dialog: 'shortcuts' } }
export const QuitConfirmation: Story = { args: { dialog: 'quit' } }
export const ErrorFeedback: Story = { parameters: { openforge: chromeScenario('error') } }
export const Checkpoint: Story = { parameters: { openforge: chromeScenario('checkpoint') } }
export const PipelineFailure: Story = { parameters: { openforge: chromeScenario('pipeline') } }
export const TaskCreated: Story = { parameters: { openforge: chromeScenario('success') } }
export const RateLimited: Story = { parameters: { openforge: chromeScenario('rate-limit') } }
export const DialogWithFeedback: Story = { args: { dialog: 'quit' }, parameters: { openforge: chromeScenario('error') } }
export const ToggleSidebar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (let repeat = 0; repeat < 2; repeat++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
      await expect(canvas.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
      await userEvent.click(canvas.getByRole('button', { name: 'Expand sidebar' }))
      await expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
    }
  },
}
export const Navigate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Global Settings' }))
    await expect(canvas.getByRole('button', { name: 'Global Settings' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.queryByRole('navigation', { name: 'Project tools' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Documentation and contributor onboarding' }))
    await expect(canvas.getByRole('heading', { name: 'Documentation and contributor onboarding' })).toBeVisible()
    await expect(canvas.getByRole('navigation', { name: 'Project tools' })).toBeVisible()
  },
}
export const OpenCloseDialogs: Story = {
  args: { controls: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(getComputedStyle(canvasElement.ownerDocument.body).pointerEvents).not.toBe('none'))
    for (let repeat = 0; repeat < 2; repeat++) {
      await userEvent.click(canvas.getByRole('button', { name: 'Keyboard shortcuts' }))
      await expect(canvas.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeVisible()
      await userEvent.keyboard('{Escape}')
      await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(getComputedStyle(canvasElement.ownerDocument.body).pointerEvents).not.toBe('none'))
      await userEvent.click(canvas.getByRole('button', { name: 'Quit application' }))
      await expect(canvas.getByRole('dialog', { name: 'Agents still running' })).toBeVisible()
      await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
      await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(getComputedStyle(canvasElement.ownerDocument.body).pointerEvents).not.toBe('none'))
    }
  },
}
export const DismissFeedback: Story = {
  parameters: { openforge: chromeScenario('error') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss notification' }))
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
  },
}

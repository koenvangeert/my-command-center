import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, within } from 'storybook/test'
import SdkPage from '../../shared/fixtures/SdkPage.svelte'
import { createStorySectionAdapter } from '../../shared/environment/storySectionAdapter'

const meta = {
  title: 'Pages/SDK page shell', component: SdkPage,
  parameters: { openforge: { adapters: () => [createStorySectionAdapter()] } },
} satisfies Meta<typeof SdkPage>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const Empty: Story = { args: { scenario: 'empty' } }
export const Loading: Story = { args: { scenario: 'loading' } }
export const Error: Story = { args: { scenario: 'error' } }
export const Overflow: Story = { args: { scenario: 'overflow' } }
export const Collapsed: Story = {
  parameters: { openforge: { adapters: () => [createStorySectionAdapter(['plugin:catalog:report'])] } },
}
export const RetryAndCollapse: Story = {
  args: { scenario: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }))
    const toggle = canvas.getByRole('button', { name: 'Weekly report' })
    toggle.focus()
    await userEvent.keyboard('{Enter}')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard(' ')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByRole('heading', { name: 'Changes ready for review' })).toBeVisible()
  },
}
export const CreateFirstReport: Story = {
  args: { scenario: 'empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create report' }))
    await expect(canvas.getByRole('button', { name: 'Weekly report' })).toBeVisible()
    await expect(canvas.queryByText('No reports yet')).not.toBeInTheDocument()
  },
}

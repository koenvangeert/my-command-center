import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, within } from 'storybook/test'
import SdkSidebarLink from '../../shared/fixtures/SdkSidebarLink.svelte'

const meta = { title: 'SDK/Sidebar link', component: SdkSidebarLink } satisfies Meta<typeof SdkSidebarLink>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Active: Story = { args: { active: true } }
export const Collapsed: Story = { args: { active: true, collapsed: true } }
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('button', { name: 'Project reports' })
    await expect(link).not.toHaveAttribute('aria-current')
    link.focus()
    await userEvent.keyboard('{Enter}')
    await expect(link).toHaveAttribute('aria-current', 'page')
  },
}

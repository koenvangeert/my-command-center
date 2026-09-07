import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import Fields from './Fields.svelte'
import { narrowViewport } from './narrowViewport'

const meta = {
  title: 'Components/Plugin SDK/Fields', component: Fields,
  args: { onValue: fn() },
} satisfies Meta<typeof Fields>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { state: 'selected' } }
export const Disabled: Story = {
  args: { state: 'disabled' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    for (const field of canvas.getAllByRole('textbox')) await expect(field).toBeDisabled()
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Include archived tasks' }))
    await userEvent.click(canvas.getByRole('switch', { name: 'Enable notifications' }))
    await expect(args.onValue).not.toHaveBeenCalled()
  },
}
export const Validation: Story = {
  args: { state: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: 'Project name' })).toHaveAccessibleDescription('Shown in the project switcher. Enter a project name.')
    await expect(canvas.getByRole('textbox', { name: 'Instructions' })).toHaveAttribute('aria-invalid', 'true')
  },
}
export const NarrowOverflow: Story = { ...narrowViewport, args: { state: 'overflow' } }
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByRole('textbox', { name: 'Project name' })
    await expect(name).toHaveValue('')
    await userEvent.type(name, 'OpenForge')
    await expect(args.onValue).toHaveBeenLastCalledWith('name', 'OpenForge')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Instructions' }), 'Run tests')
    await expect(args.onValue).toHaveBeenLastCalledWith('instructions', 'Run tests')
    canvas.getByRole('checkbox', { name: 'Include archived tasks' }).focus()
    await userEvent.keyboard(' ')
    await expect(args.onValue).toHaveBeenLastCalledWith('archived', true)
    canvas.getByRole('switch', { name: 'Enable notifications' }).focus()
    await userEvent.keyboard(' ')
    await expect(args.onValue).toHaveBeenLastCalledWith('notifications', true)
  },
}

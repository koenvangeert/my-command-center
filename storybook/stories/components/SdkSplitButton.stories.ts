import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SdkSplitButton from '../../shared/fixtures/SdkSplitButton.svelte'

const meta = {
  title: 'SDK/Split button',
  component: SdkSplitButton,
  args: { onAction: fn() },
} satisfies Meta<typeof SdkSplitButton>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Menu: Story = { args: { initiallyOpen: true } }
export const LongLabel: Story = { args: { initiallyOpen: true, longLabel: true } }
export const SizesVariantsAndDisabled: Story = { args: { matrix: true } }
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const primary = canvas.getByRole('button', { name: 'Complete', exact: true })
    primary.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onAction).toHaveBeenCalledWith('complete')
    await userEvent.tab()
    const trigger = canvas.getByRole('button', { name: 'More report actions' })
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(body.findByRole('menuitem', { name: 'Set aside' })).resolves.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
  },
}

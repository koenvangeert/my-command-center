import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import SdkOverlays from '../../shared/fixtures/SdkOverlays.svelte'

const meta = { title: 'SDK/Overlays', component: SdkOverlays, args: { onAction: fn() } } satisfies Meta<typeof SdkOverlays>
export default meta
type Story = StoryObj<typeof meta>

export const Modal: Story = { args: { initiallyOpen: true } }
export const LockedModal: Story = {
  args: { initiallyOpen: true, locked: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.findByRole('dialog', { name: 'Edit report' })).resolves.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(body.getByRole('dialog')).toBeVisible()
    await expect(body.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  },
}
export const EditAndReopen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Edit report' })
    await waitFor(() => expect(getComputedStyle(trigger).pointerEvents).not.toBe('none'))
    await userEvent.click(trigger)
    const input = await body.findByRole('textbox', { name: 'Report name' })
    await expect(input).toHaveFocus()
    await userEvent.clear(input)
    await userEvent.type(input, 'Release notes')
    await userEvent.tab()
    await expect(body.getByRole('button', { name: 'Save report' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onAction).toHaveBeenCalledWith('Release notes')
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(getComputedStyle(trigger).pointerEvents).not.toBe('none'))
    await userEvent.click(trigger)
    await expect(body.getByRole('textbox', { name: 'Report name' })).toHaveValue('Release notes')
    await userEvent.keyboard('{Escape}')
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument()
  },
}
export const Menu: Story = { args: { kind: 'menu', initiallyOpen: true } }
export const EmptyMenu: Story = { args: { kind: 'menu', initiallyOpen: true, empty: true } }
export const MenuKeyboard: Story = {
  args: { kind: 'menu' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Report menu' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Open report' })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    await expect(body.getByRole('menuitemcheckbox', { name: 'Pin report' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onAction).toHaveBeenCalledWith('pin')
    await expect(body.getByRole('menuitemcheckbox')).toHaveAttribute('aria-checked', 'false')
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
    await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument())
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Open report' })).toHaveFocus())
    // KVG-4808 owns rapid-reopen autofocus. Test navigation after the opening paint settles.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Delete report' })).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await expect(args.onAction).toHaveBeenCalledWith('delete')
  },
}
export const Tooltip: Story = { args: { kind: 'tooltip', initiallyOpen: true } }
export const TooltipKeyboard: Story = {
  args: { kind: 'tooltip' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'About reports' })).toHaveFocus()
    await expect(body.findByRole('tooltip')).resolves.toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body.queryByRole('tooltip')).not.toBeInTheDocument())
  },
}

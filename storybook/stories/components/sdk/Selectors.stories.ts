import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import Selectors from './Selectors.svelte'
import { narrowViewport } from './narrowViewport'

const meta = {
  title: 'Components/Plugin SDK/Selectors', component: Selectors,
  args: { onValue: fn(), onOpen: fn() },
} satisfies Meta<typeof Selectors>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { state: 'selected' } }
export const Disabled: Story = {
  args: { state: 'disabled' },
  play: async ({ canvasElement, args }) => {
    const provider = within(canvasElement).getByRole('button', { name: 'Provider' })
    await expect(provider).toBeDisabled()
    await userEvent.click(provider)
    await expect(args.onOpen).not.toHaveBeenCalled()
    for (const project of within(canvasElement).getAllByRole('combobox')) {
      await expect(project).toHaveAttribute('aria-disabled', 'true')
      await userEvent.click(project)
    }
    await expect(within(canvasElement).queryByRole('listbox')).not.toBeInTheDocument()
    await expect(args.onValue).not.toHaveBeenCalled()
  },
}
export const Validation: Story = { args: { state: 'error' } }
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Provider' }))
    await expect(within(canvasElement.ownerDocument.body).getByRole('option', { name: 'Unavailable provider' })).toHaveAttribute('aria-disabled', 'true')
  },
}
export const NarrowOverflow: Story = {
  ...narrowViewport,
  args: { state: 'overflow' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Project' }))
    await expect(within(canvasElement).getAllByRole('option')).toHaveLength(27)
  },
}
export const Empty: Story = {
  args: { state: 'empty' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox', { name: 'Project' }))
    await expect(within(canvasElement).getByText('No matches')).toBeVisible()
  },
}
export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Project' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search options' }), 'unknown project')
    await expect(canvas.getByText('No matches')).toBeVisible()
    canvasElement.dataset.sdkReady = 'no-matches'
  },
}
export const BoundedResults: Story = {
  args: { state: 'large' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const project = canvas.getByRole('combobox', { name: 'Project' })
    await expect(project).toHaveTextContent('Workspace 5000')
    await userEvent.click(project)
    await expect(canvas.getAllByRole('option')).toHaveLength(40)
    await expect(canvas.getByRole('status')).toHaveTextContent('Showing 40 of 5000 results. Refine your search.')
    canvasElement.dataset.sdkReady = 'bounded-results'
  },
}
export const KeywordSearch: Story = {
  args: { state: 'large' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const project = canvas.getByRole('combobox', { name: 'Project' })
    await userEvent.click(project)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search options' }), 'p-4999')
    await expect(canvas.getByRole('option')).toHaveTextContent('Workspace 4999')
    await expect(canvas.getByRole('status')).toHaveTextContent('1 result')
    await userEvent.keyboard('{Enter}')
    await expect(args.onValue).toHaveBeenLastCalledWith('project', 'project-4999')
    await expect(project).toHaveTextContent('Workspace 4999')
    await expect(project).toHaveFocus()
    await userEvent.click(project)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search options' }), 'p-4999')
    await expect(canvas.getByRole('option')).toHaveAttribute('aria-selected', 'true')
    canvasElement.dataset.sdkReady = 'keyword-search'
  },
}
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const provider = canvas.getByRole('button', { name: 'Provider' })
    provider.focus()
    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}')
    await expect(args.onValue).toHaveBeenLastCalledWith('provider', 'codex')
    await expect(provider).toHaveFocus()
    await userEvent.keyboard('{Enter}{Escape}')
    await expect(args.onOpen).toHaveBeenLastCalledWith(false)
    const project = canvas.getByRole('combobox', { name: 'Project' })
    project.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Search options' }), 'website')
    await userEvent.keyboard('{Enter}')
    await expect(args.onValue).toHaveBeenLastCalledWith('project', 'website')
    await expect(project).toHaveTextContent('Website')
    await expect(project).toHaveFocus()
    await userEvent.click(project)
    await expect(canvas.getByRole('textbox', { name: 'Search options' })).toHaveValue('')
    await userEvent.keyboard('{Escape}')
    await expect(project).toHaveAttribute('aria-expanded', 'false')
    await expect(project).toHaveFocus()
  },
}

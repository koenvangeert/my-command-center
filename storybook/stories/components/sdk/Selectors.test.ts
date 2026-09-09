import '@testing-library/jest-dom/vitest'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Selectors from './Selectors.svelte'

describe('SDK selector catalog', () => {
  it('filters options, publishes a selection, and resets query and value on scenario replacement', async () => {
    const onValue = vi.fn()
    const view = render(Selectors, { onValue })
    await fireEvent.click(view.getByRole('combobox', { name: 'Project' }))
    const search = view.getByRole('textbox', { name: 'Search options' })
    await fireEvent.input(search, { target: { value: 'website' } })
    expect(view.getAllByRole('option')).toHaveLength(1)
    await fireEvent.keyDown(search, { key: 'Enter' })
    expect(onValue).toHaveBeenLastCalledWith('project', 'website')
    expect(view.getByRole('combobox', { name: 'Project' })).toHaveTextContent('Website')
    await view.rerender({ state: 'selected' })
    await view.rerender({ state: 'default' })
    expect(view.getByRole('combobox', { name: 'Project' })).toHaveTextContent('Choose a project')
    await fireEvent.click(view.getByRole('combobox', { name: 'Project' }))
    expect(view.getByRole('textbox', { name: 'Search options' })).toHaveValue('')
  })

  it('shows disabled searchable controls without allowing selection', async () => {
    const onValue = vi.fn()
    const view = render(Selectors, { state: 'disabled', onValue })
    for (const trigger of view.getAllByRole('combobox')) {
      expect(trigger).toHaveAttribute('aria-disabled', 'true')
      await fireEvent.click(trigger)
      await fireEvent.keyDown(trigger, { key: 'Enter' })
    }
    expect(view.queryByRole('listbox')).toBeNull()
    expect(onValue).not.toHaveBeenCalled()
  })

  it('demonstrates bounded keyword search over 5000 projects while retaining the selected label', async () => {
    const onValue = vi.fn()
    const view = render(Selectors, { state: 'large', onValue })
    const trigger = view.getByRole('combobox', { name: 'Project' })
    expect(trigger).toHaveTextContent('Workspace 5000')
    await fireEvent.click(trigger)
    expect(view.getAllByRole('option')).toHaveLength(40)
    expect(view.getByRole('status')).toHaveTextContent('Showing 40 of 5000 results. Refine your search.')
    await fireEvent.input(view.getByRole('textbox', { name: 'Search options' }), { target: { value: 'P-4999' } })
    expect(view.getByRole('option')).toHaveTextContent('Workspace 4999')
    await fireEvent.keyDown(view.getByRole('textbox', { name: 'Search options' }), { key: 'Enter' })
    expect(onValue).toHaveBeenLastCalledWith('project', 'project-4999')
    expect(trigger).toHaveTextContent('Workspace 4999')
    expect(trigger).toHaveFocus()
  })
})

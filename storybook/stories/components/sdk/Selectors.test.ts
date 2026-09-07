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
})

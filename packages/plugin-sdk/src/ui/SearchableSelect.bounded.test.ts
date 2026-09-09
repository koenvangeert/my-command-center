import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SearchableSelect from '@openforge-app/plugin-sdk/ui/SearchableSelect.svelte'

const options = Array.from({ length: 5000 }, (_, index) => ({
  value: `project-${index}`,
  label: `Project ${index}`,
  keywords: [`ID-${index}`],
}))

describe('SearchableSelect public bounded search', () => {
  it('renders only the first 40 matches while preserving a selected label outside the limit', async () => {
    render(SearchableSelect, {
      options, value: 'project-4999', maxResults: 40, ariaLabel: 'Project', onSelect: vi.fn(),
    })
    const trigger = screen.getByRole('combobox', { name: 'Project' })
    expect(trigger).toHaveTextContent('Project 4999')
    await fireEvent.click(trigger)
    expect(screen.getAllByRole('option')).toHaveLength(40)
    expect(screen.getAllByRole('option')[39]).toHaveTextContent('Project 39')
    expect(screen.getByRole('status')).toHaveTextContent('Showing 40 of 5000 results. Refine your search.')
    await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Project 4999' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
    await fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(trigger).toHaveTextContent('Project 4999')
  })

  it('searches caller keywords across all options without changing labels or selected values', async () => {
    const onSelect = vi.fn()
    render(SearchableSelect, { options, value: '', maxResults: 40, onSelect })
    await fireEvent.click(screen.getByRole('combobox'))
    const input = screen.getByRole('textbox')
    await fireEvent.input(input, { target: { value: '  id-4999  ' } })
    expect(screen.getByRole('option')).toHaveTextContent('Project 4999')
    expect(screen.getByRole('option')).not.toHaveTextContent('ID-4999')
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('project-4999')
  })

  it('blocks pointer and keyboard activation while disabled and closes when disabled mid-search', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(SearchableSelect, {
      options, value: 'project-4999', maxResults: 40, disabled: true, onSelect,
    })
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(trigger).toHaveAttribute('tabindex', '-1')
    await fireEvent.click(trigger)
    await fireEvent.keyDown(trigger, { key: 'Enter' })
    await fireEvent.keyDown(trigger, { key: ' ' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveTextContent('Project 4999')
    await rerender({ disabled: false })
    await fireEvent.click(trigger)
    const input = screen.getByRole('textbox')
    const option = screen.getAllByRole('option')[0]
    await fireEvent.input(input, { target: { value: '4999' } })
    await rerender({ disabled: true })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await fireEvent.keyDown(input, { key: 'Enter' })
    await fireEvent.click(option)
    expect(onSelect).not.toHaveBeenCalled()
    await rerender({ disabled: false })
    await fireEvent.click(trigger)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getAllByRole('option')).toHaveLength(40)
  })

  it('keeps keyboard focus on visible results and announces the active option separately from selection', async () => {
    const onSelect = vi.fn()
    render(SearchableSelect, { options, value: 'project-1', maxResults: 2, ariaLabel: 'Project', onSelect })
    const trigger = screen.getByRole('combobox', { name: 'Project' })
    trigger.focus()
    await fireEvent.keyDown(trigger, { key: 'Enter' })
    const input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Project')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Project 1')
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Project 0')
    for (const key of ['ArrowDown', 'ArrowDown', 'j', 'n']) {
      await fireEvent.keyDown(input, { key, ctrlKey: key.length === 1 })
    }
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Project 1')
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('project-1')
    expect(trigger).toHaveFocus()
  })

  it('resets navigation when options, the limit, or the query change and handles no matches safely', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(SearchableSelect, { options, value: '', maxResults: 3, onSelect })
    const trigger = screen.getByRole('combobox')
    await fireEvent.click(trigger)
    const input = screen.getByRole('textbox')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await rerender({ maxResults: 1 })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Project 0')
    await rerender({ options: [{ value: 'other', label: 'Other' }] })
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('Other')
    await fireEvent.input(input, { target: { value: 'missing' } })
    expect(screen.queryByRole('option')).toBeNull()
    expect(input).not.toHaveAttribute('aria-activedescendant')
    expect(screen.getByRole('status')).toHaveTextContent('0 results')
    expect(screen.getByText('No matches')).toBeVisible()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    await fireEvent(input, enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
    await fireEvent.keyDown(input, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY, 1.8])(
    'keeps an invalid or fractional maxResults=%s bounded to one usable result', async maxResults => {
      render(SearchableSelect, { options: options.slice(0, 4), value: '', maxResults, onSelect: vi.fn() })
      await fireEvent.click(screen.getByRole('combobox'))
      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(screen.getByRole('option')).toHaveTextContent('Project 0')
    },
  )

  it('closes when focus leaves without selecting or moving focus back to the trigger', async () => {
    const onSelect = vi.fn()
    render(SearchableSelect, { options: options.slice(0, 2), value: '', maxResults: 1, onSelect })
    await fireEvent.click(screen.getByRole('combobox'))
    const input = screen.getByRole('textbox')
    const next = document.createElement('button')
    document.body.append(next)
    try {
      next.focus()
      await fireEvent.focusOut(input, { relatedTarget: next })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(next).toHaveFocus()
      expect(onSelect).not.toHaveBeenCalled()
    } finally {
      next.remove()
    }
  })

  it('associates a polite result count with each search input without ID collisions', async () => {
    render(SearchableSelect, { options: [], value: '', maxResults: 40, ariaLabel: 'Empty', onSelect: vi.fn() })
    render(SearchableSelect, { options: options.slice(0, 2), value: '', maxResults: 1, ariaLabel: 'Project', onSelect: vi.fn() })
    const [empty, project] = screen.getAllByRole('combobox')
    expect(empty.getAttribute('aria-controls')).not.toBe(project.getAttribute('aria-controls'))
    await fireEvent.click(empty)
    const input = screen.getByRole('textbox')
    const status = screen.getByRole('status')
    expect(input).toHaveAttribute('aria-describedby', status.id)
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
    expect(status).toHaveTextContent('0 results')
  })

  it('preserves unlimited results, empty-string selections, badges, and caller-owned value updates', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(SearchableSelect, {
      options: [{ value: '', label: 'All projects', badge: 'All' }, ...options.slice(0, 50)],
      value: '', placeholder: 'Pick a project', onSelect,
    })
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('All projects')
    expect(trigger).toHaveTextContent('All')
    await fireEvent.click(trigger)
    expect(screen.getAllByRole('option')).toHaveLength(51)
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('All projects')
    await fireEvent.click(screen.getByRole('option', { name: 'Project 49' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('project-49')
    expect(trigger).toHaveTextContent('All projects')
    await rerender({ value: 'project-49', maxResults: 1 })
    expect(trigger).toHaveTextContent('Project 49')
    await fireEvent.click(trigger)
    await fireEvent.input(screen.getByRole('textbox'), { target: { value: '  ALL PROJECTS  ' } })
    await fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowUp' })
    await fireEvent.keyDown(screen.getByRole('textbox'), { key: 'p', ctrlKey: true })
    await fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSelect).toHaveBeenLastCalledWith('')
    await rerender({ value: 'unknown' })
    expect(trigger).toHaveTextContent('Pick a project')
  })
})

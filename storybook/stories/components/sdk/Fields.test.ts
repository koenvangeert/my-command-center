import '@testing-library/jest-dom/vitest'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Fields from './Fields.svelte'

describe('SDK form catalog', () => {
  it('publishes edits and replaces edited controls when the scenario changes', async () => {
    const onValue = vi.fn()
    const view = render(Fields, { onValue })
    await fireEvent.input(view.getByRole('textbox', { name: 'Project name' }), { target: { value: 'Edited' } })
    expect(onValue).toHaveBeenLastCalledWith('name', 'Edited')
    await fireEvent.click(view.getByRole('checkbox', { name: 'Include archived tasks' }))
    expect(onValue).toHaveBeenLastCalledWith('archived', true)
    await view.rerender({ state: 'error' })
    expect(view.getByRole('textbox', { name: 'Project name' })).toHaveAttribute('aria-invalid', 'true')
    await view.rerender({ state: 'default' })
    expect(view.getByRole('textbox', { name: 'Project name' })).toHaveValue('')
    expect(view.getByRole('checkbox', { name: 'Include archived tasks' })).not.toBeChecked()
  })
})

import '@testing-library/jest-dom/vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Actions from './Actions.svelte'

describe('SDK action catalog', () => {
  it('reports activation through callbacks and leaves disabled actions inert', async () => {
    const onAction = vi.fn()
    const view = render(Actions, { onAction })
    await fireEvent.click(view.getByRole('button', { name: 'Create task' }))
    await fireEvent.click(view.getByRole('button', { name: 'Refresh' }))
    expect(onAction.mock.calls.map(([action]) => action)).toEqual(['create', 'refresh'])
    await view.rerender({ state: 'disabled' })
    expect(view.getByRole('button', { name: 'Create task' })).toBeDisabled()
    expect(view.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  })
})

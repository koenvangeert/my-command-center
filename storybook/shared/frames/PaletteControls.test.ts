import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import PaletteControls from './PaletteControls.svelte'

afterEach(cleanup)
it('filters the palette controls, selects with the keyboard, and reopens cleanly', async () => {
  const onSelect = vi.fn()
  render(PaletteControls, { onSelect })
  const input = screen.getByPlaceholderText('Filter catalog entries...')
  await fireEvent.input(input, { target: { value: 'files' } })
  expect(screen.getAllByRole('option')).toHaveLength(1)
  await fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSelect).toHaveBeenCalledWith('Files')
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen controls' }))
  expect(screen.getByPlaceholderText('Filter catalog entries...')).toHaveValue('')
  expect(screen.getAllByRole('option')).toHaveLength(3)
})

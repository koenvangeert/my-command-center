import '@testing-library/jest-dom/vitest'
import { fireEvent, render } from '@testing-library/svelte'
import { expect, it, vi } from 'vitest'
import Navigation from './Navigation.svelte'

it('activates a sidebar contribution and keeps its accessible name when collapsed', async () => {
  const onActivate = vi.fn()
  const view = render(Navigation, { onActivate })
  await fireEvent.click(view.getByRole('button', { name: 'Project files' }))
  expect(onActivate).toHaveBeenCalledOnce()
  await view.rerender({ state: 'collapsed' })
  expect(view.getByRole('button', { name: 'Project files' })).toHaveAccessibleName('Project files')
})

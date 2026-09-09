import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import BranchDivergencePage from './BranchDivergencePage.svelte'
import { branchDivergenceRequest } from '../../../src/lib/branchDivergenceModalStore'
import { get } from 'svelte/store'

afterEach(cleanup)
it('resolves the start decision and releases an unanswered request on unmount', async () => {
  const onChoice = vi.fn()
  const view = render(BranchDivergencePage, { onChoice })
  await fireEvent.click(await screen.findByRole('button', { name: 'Keep local' }))
  await waitFor(() => expect(onChoice).toHaveBeenCalledWith('keepLocal'))
  expect(get(branchDivergenceRequest)).toBeNull()
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
  await screen.findByRole('dialog', { name: 'Resolve branch divergence' })
  view.unmount()
  expect(get(branchDivergenceRequest)).toBeNull()
  expect(onChoice).toHaveBeenCalledTimes(1)
})

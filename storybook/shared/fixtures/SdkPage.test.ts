import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { expect, it } from 'vitest'
import SdkPage from './SdkPage.svelte'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryStorageAdapter } from '../environment/storyStorageAdapter'
import { createStorySectionAdapter } from '../environment/storySectionAdapter'

it('recovers reports and clears a collapsed section before the next mount', async () => {
  const environment = createStoryEnvironment({
    id: 'reports', now: 0,
    adapters: [createStoryStorageAdapter(localStorage), createStorySectionAdapter()],
  })
  await environment.install()
  try {
    const first = render(SdkPage, { scenario: 'error', framed: false })
    expect(screen.getByRole('alert')).toHaveTextContent('The report index is unavailable')
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const toggle = screen.getByRole('button', { name: 'Weekly report' })
    await fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    first.unmount()
    await environment.reset()
    render(SdkPage, { framed: false })
    expect(screen.getByRole('button', { name: 'Weekly report' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: 'Changes ready for review' })).toBeVisible()
  } finally {
    cleanup()
    await environment.dispose()
  }
})

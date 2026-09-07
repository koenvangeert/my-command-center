import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { chromeScenario } from '../fixtures/chromeScenario'
import ChromePage from './ChromePage.svelte'

afterEach(cleanup)

describe('host chrome page', () => {
  it('supports repeated collapse, navigation and shortcut dialog open/close', async () => {
    const environment = createStoryEnvironment({ id: 'chrome-page', now: 1767346200000, adapters: [createStoryDesktopAdapter(), ...(chromeScenario().adapters?.() ?? [])] })
    await environment.install()
    try {
      render(ChromePage, { controls: true })
      await fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
      await fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
      await fireEvent.click(screen.getByRole('button', { name: 'Global Settings' }))
      expect(screen.getByRole('button', { name: 'Global Settings' }).getAttribute('aria-current')).toBe('page')
      for (let repeat = 0; repeat < 2; repeat++) {
        await fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }))
        expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeTruthy()
        await fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).toBeNull()
      }
    } finally {
      cleanup()
      await environment.dispose()
    }
  })
})

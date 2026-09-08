import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { composeStories } from '@storybook/svelte-vite'
import * as stories from '../stories/pages/AttentionOverview.stories'
import { getConfig } from '../../src/lib/ipc'
import { storyEnvironmentPreview } from './storyEnvironmentPreview'

const disposals: Array<() => Promise<void>> = []
const { Populated, Failure, Empty } = composeStories(stories, {
  ...storyEnvironmentPreview,
  async beforeEach(context) {
    const dispose = await storyEnvironmentPreview.beforeEach(context)
    disposals.push(dispose)
    return dispose
  },
})
afterEach(async () => {
  cleanup()
  for (const dispose of disposals.splice(0).reverse()) await dispose()
})

describe('attention catalog destination', () => {
  it('resets preferences between renders and distinguishes failed loads from empty lanes', async () => {
    const canvas = document.createElement('div')
    document.body.append(canvas)
    try {
      await Populated.run({ canvasElement: canvas, testingLibraryRender: render })
      expect(await screen.findByText('Normalize the greeting')).toBeTruthy()
      await fireEvent.click(screen.getByText('OpenForge'))
      await waitFor(() => expect(screen.queryByText('Normalize the greeting')).toBeNull())
      await waitFor(async () => expect(await getConfig('attention_overview_collapsed_projects')).toBe('["project-1"]'))
      localStorage.setItem('attention-test-layout', 'edited')
      await Populated.run({ canvasElement: canvas, testingLibraryRender: render })
      expect(await screen.findByText('Normalize the greeting')).toBeTruthy()
      expect(await getConfig('attention_overview_collapsed_projects')).toBeNull()
      expect(localStorage.getItem('attention-test-layout')).toBeNull()
      await Failure.run({ canvasElement: canvas, testingLibraryRender: render })
      expect((await screen.findByRole('alert')).textContent).toContain("Couldn't load attention overview.")
      expect(screen.getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(false)
      expect(screen.queryByText("You're all caught up")).toBeNull()
      await Empty.run({ canvasElement: canvas, testingLibraryRender: render })
      expect(await screen.findByText("You're all caught up")).toBeTruthy()
      expect(screen.getByRole('dialog', { name: 'Attention overview' })).toBeTruthy()
    } finally { canvas.remove() }
  })
})

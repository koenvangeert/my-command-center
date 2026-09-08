import { expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { composeStories } from '@storybook/svelte-vite'
import * as stories from '../stories/components/BoardFilters.stories'
import { storyEnvironmentPreview } from './storyEnvironmentPreview'

it('repeats label selection in one document without retaining the previous menu or duplicating callbacks', async () => {
  const disposals: Array<() => Promise<void>> = []
  const { Default } = composeStories(stories, {
    ...storyEnvironmentPreview,
    async beforeEach(context) {
      const dispose = await storyEnvironmentPreview.beforeEach(context)
      disposals.push(dispose)
      return dispose
    },
  })
  const canvas = document.createElement('div')
  document.body.append(canvas)
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await Default.run({ canvasElement: canvas, testingLibraryRender: render })
      await fireEvent.click(screen.getByRole('button', { name: 'Filter by Task Labels' }))
      await fireEvent.click(await screen.findByText('accessibility'))
      expect(Default.args.onToggle).toHaveBeenCalledWith(1)
      expect(Default.args.onToggle).toHaveBeenCalledTimes(attempt + 1)
    }
  } finally {
    cleanup()
    for (const dispose of disposals.reverse()) await dispose()
    canvas.remove()
  }
})

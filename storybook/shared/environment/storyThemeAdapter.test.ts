import { expect, it } from 'vitest'
import { get } from 'svelte/store'
import { selectedTheme } from '../../../src/lib/theme'
import { createStoryDesktopAdapter } from './storyDesktopAdapter'
import { createStoryThemeAdapter } from './storyThemeAdapter'

it.each([
  ['openforge-dark', 'dark'],
  ['workshop-light', 'light'], ['workshop-dark', 'dark'],
])('applies %s to document and runtime subscribers then restores it', async (id, appearance) => {
  const previous = get(selectedTheme).id
  const desktop = createStoryDesktopAdapter()
  const theme = createStoryThemeAdapter(id)
  desktop.install()
  try {
    await theme.install()
    expect(get(selectedTheme).id).toBe(id)
    expect(document.documentElement.dataset.theme).toBe(id)
    expect(document.documentElement.dataset.themeAppearance).toBe(appearance)
    await theme.dispose()
    expect(get(selectedTheme).id).toBe(previous)
    expect(document.documentElement.dataset.theme).toBe(previous)
  } finally {
    await theme.dispose()
    desktop.dispose()
  }
})

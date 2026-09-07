import { describe, expect, it } from 'vitest'
import preview from './preview'

describe('Storybook theme choices', () => {
  it('offers all built-in variants without changing the initial theme', () => {
    expect(preview.initialGlobals?.openforgeTheme).toBe('openforge-light')
    expect(preview.globalTypes?.openforgeTheme.toolbar.items).toEqual([
      { value: 'openforge-light', title: 'OpenForge Light' },
      { value: 'openforge-dark', title: 'OpenForge Dark' },
      { value: 'workshop-light', title: 'Workshop Light' },
      { value: 'workshop-dark', title: 'Workshop Dark' },
    ])
  })
})

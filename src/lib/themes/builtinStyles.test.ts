import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, THEME_TOKEN_NAMES, validateThemeDefinition } from '../themeContract'

const variants = [
  ['openforge-light', 'OpenForge Light', 'light'],
  ['openforge-dark', 'OpenForge Dark', 'dark'],
  ['workshop-light', 'Workshop Light', 'light'],
  ['workshop-dark', 'Workshop Dark', 'dark'],
] as const

describe('selectable built-in styles', () => {
  it('replaces OpenForge designs without exposing duplicate Studio choices', () => {
    expect(BUILTIN_THEMES.map(theme => theme.id)).toEqual([
      'openforge-light', 'openforge-dark', 'workshop-light', 'workshop-dark',
    ])
    for (const theme of BUILTIN_THEMES.slice(0, 2)) {
      expect(parseFloat(theme.tokens.radiusControl)).toBeGreaterThanOrEqual(8)
    }
  })
  it.each(variants)('provides a complete immutable %s theme', (id, label, appearance) => {
    const matches = BUILTIN_THEMES.filter((theme) => theme.id === id)
    expect(matches).toHaveLength(1)
    const [theme] = matches
    expect(theme).toMatchObject({ id, label, appearance })
    expect(validateThemeDefinition(theme)).toEqual({ valid: true, errors: [] })
    expect(Object.keys(theme.tokens).sort()).toEqual([...THEME_TOKEN_NAMES].sort())
    expect(Object.isFrozen(theme)).toBe(true)
    expect(Object.isFrozen(theme.tokens)).toBe(true)
  })
})

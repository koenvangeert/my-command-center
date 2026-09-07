import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, DARK_THEME } from './themeContract'
import { createTerminalThemeSnapshot } from './terminalThemePresentation'

describe('terminal theme presentation adapter', () => {
  it.each(BUILTIN_THEMES)('presents $label without prescribing a terminal font', (theme) => {
    const snapshot = createTerminalThemeSnapshot(theme)
    expect(snapshot.appearance).toBe(theme.appearance)
    expect(snapshot.terminalTheme).toMatchObject({
      background: theme.tokens.terminalBackground, foreground: theme.tokens.terminalForeground,
      cursor: theme.tokens.terminalCursor, cursorAccent: theme.tokens.terminalCursorAccent,
      selectionBackground: theme.tokens.terminalSelectionBackground, selectionForeground: theme.tokens.terminalSelectionForeground,
      red: theme.tokens.terminalRed, green: theme.tokens.terminalGreen,
      blue: theme.tokens.terminalBlue, yellow: theme.tokens.terminalYellow,
    })
    expect(Object.keys(snapshot.terminalTheme)).toHaveLength(22)
    expect(snapshot).not.toHaveProperty('fontFamily')
    expect(snapshot.terminalTheme).not.toHaveProperty('fontFamily')
  })

  it('maps explicit appearance and every selected terminal token without inspecting the theme id', () => {
    const theme = {
      ...DARK_THEME,
      id: 'vendor:midnight',
      appearance: 'dark' as const,
      tokens: {
        ...DARK_THEME.tokens,
        terminalBackground: '#010203',
        terminalForeground: '#f1f2f3',
        terminalRed: '#c01122',
        terminalBrightRed: '#ff4455',
      },
    }

    const snapshot = createTerminalThemeSnapshot(theme)

    expect(snapshot.appearance).toBe('dark')
    expect(snapshot.terminalTheme.background).toBe('#010203')
    expect(snapshot.terminalTheme.foreground).toBe('#f1f2f3')
    expect(snapshot.terminalTheme.red).toBe('#c01122')
    expect(snapshot.terminalTheme.brightRed).toBe('#ff4455')
    expect(Object.keys(snapshot.terminalTheme)).toHaveLength(22)
  })
})

import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, DARK_THEME, LIGHT_THEME, type ThemeDefinition, type ThemeTokenName } from './themeContract'

type ContrastPair = readonly [ThemeTokenName, ThemeTokenName, number]

const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ['text', 'canvas', 4.5],
  ['textSecondary', 'surface', 4.5],
  ['controlText', 'control', 4.5],
  ['focusRing', 'control', 3],
  ['onAccent', 'accent', 4.5],
  ['success', 'surface', 4.5],
  ['warning', 'surface', 4.5],
  ['danger', 'surface', 4.5],
]

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Expected an opaque six-digit color, received ${hex}`)
  const channels = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255)
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first: string, second: string): number {
  const brightest = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darkest = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (brightest + 0.05) / (darkest + 0.05)
}

const builtins: readonly [string, ThemeDefinition][] = [
  ['light', LIGHT_THEME],
  ['dark', DARK_THEME],
]

describe.each(builtins)('OpenForge %s theme', (_name, theme) => {
  it.each(CONTRAST_PAIRS)('%s remains visible against %s', (foreground, background, minimum) => {
    expect(contrastRatio(theme.tokens[foreground], theme.tokens[background])).toBeGreaterThanOrEqual(minimum)
  })

  it('uses rounded Studio geometry without changing density or typography', () => {
    expect(theme.tokens).toMatchObject({
      borderWidth: '1px',
      focusWidth: '2px',
      radiusControl: '8px',
      radiusContainer: '12px',
      radiusOverlay: '16px',
      controlHeightCompact: '28px',
      controlHeight: '36px',
      fontSans: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
      fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    })
  })
})

const stylePairs: ContrastPair[] = [
  ...CONTRAST_PAIRS,
  ['textMuted', 'surfaceSubtle', 4.5], ['textSecondary', 'surfaceRaised', 4.5],
  ['controlText', 'controlHover', 4.5], ['controlText', 'controlPressed', 4.5],
  ['controlText', 'field', 4.5], ['controlText', 'fieldHover', 4.5],
  ['onAccent', 'accentHover', 4.5], ['onAccent', 'accentPressed', 4.5],
  ['onAccentSubtle', 'accentSubtle', 4.5], ['link', 'canvas', 4.5],
  ['focusRing', 'canvas', 3], ['focusRing', 'surfaceRaised', 3],
  ['borderInteractive', 'field', 3], ['fieldInvalid', 'field', 3],
  ['codeText', 'codeCanvas', 4.5], ['codeMuted', 'codeCanvas', 4.5],
  ['diffAdded', 'diffAddedSubtle', 4.5], ['diffRemoved', 'diffRemovedSubtle', 4.5], ['diffChanged', 'diffChangedSubtle', 4.5],
  ['terminalForeground', 'terminalBackground', 4.5], ['terminalSelectionForeground', 'terminalSelectionBackground', 4.5],
  ['terminalCursor', 'terminalBackground', 3], ['terminalCursorAccent', 'terminalCursor', 4.5],
]
for (const [foreground, background] of [
  ['onInfo', 'info'], ['onSuccess', 'success'], ['onWarning', 'warning'], ['onDanger', 'danger'],
  ['onStatusNeutral', 'statusNeutralSubtle'], ['onStatusRunning', 'statusRunningSubtle'],
  ['onStatusWaiting', 'statusWaitingSubtle'], ['onStatusSuccess', 'statusSuccessSubtle'],
  ['onStatusWarning', 'statusWarningSubtle'], ['onStatusDanger', 'statusDangerSubtle'],
] as const) stylePairs.push([foreground, background, 4.5])
for (const token of [
  'terminalBlack', 'terminalRed', 'terminalGreen', 'terminalYellow', 'terminalBlue', 'terminalMagenta', 'terminalCyan', 'terminalWhite',
  'terminalBrightBlack', 'terminalBrightRed', 'terminalBrightGreen', 'terminalBrightYellow', 'terminalBrightBlue', 'terminalBrightMagenta', 'terminalBrightCyan', 'terminalBrightWhite',
] as const) stylePairs.push([token, 'terminalBackground', 4.5])

describe.each(BUILTIN_THEMES.filter(theme => ['openforge-light', 'openforge-dark', 'workshop-light', 'workshop-dark'].includes(theme.id)))(
  '$label semantic contrast', (theme) => {
    it.each(stylePairs)('%s is readable against %s', (foreground, background, minimum) => {
      expect(contrastRatio(theme.tokens[foreground], theme.tokens[background])).toBeGreaterThanOrEqual(minimum)
    })
  },
)

describe.each(builtins)('Studio-designed OpenForge %s palette', (_name, theme) => {
  it('uses neutral surfaces and primary actions', () => {
    for (const name of ['canvas', 'text', 'accent'] as const) {
      const channels = theme.tokens[name].slice(1).match(/../g)!
      expect(new Set(channels).size).toBe(1)
    }
    expect(relativeLuminance(LIGHT_THEME.tokens.canvas)).toBeGreaterThan(relativeLuminance(DARK_THEME.tokens.canvas))
  })
})

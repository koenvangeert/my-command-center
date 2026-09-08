export const baselineThemeIds = ['openforge-light', 'openforge-dark', 'com.example.ink:ink', 'workshop-light', 'workshop-dark', 'com.example.copper:copper']

// Use the same registration and selection interfaces as plugin themes, not direct CSS injection.
const registryUrl = new URL('../src/lib/theme.ts', import.meta.url).pathname
const contractUrl = new URL('../src/lib/themeContract.ts', import.meta.url).pathname

export async function installBaselineThemes(page, registryModule = `/@fs${registryUrl}`) {
  await page.evaluate(async ({ registryModule, contractModule }) => {
    const { themeRegistry } = await import(registryModule)
    const { LIGHT_THEME, DARK_THEME } = await import(contractModule)
    themeRegistry.registerContributedTheme({ ...DARK_THEME, id: 'com.example.ink:ink', label: 'Ink',
      tokens: { ...DARK_THEME.tokens, surface: '#173936', field: '#202c30', accent: '#7de3cb', radiusControl: '8px' },
    }, { pluginId: 'com.example.ink', generation: 1 })
    themeRegistry.registerContributedTheme({ ...LIGHT_THEME, id: 'com.example.copper:copper', label: 'Copper',
      tokens: { ...LIGHT_THEME.tokens, surface: '#fbefd9', text: '#312419', accent: '#a34621', radiusControl: '12px' },
    }, { pluginId: 'com.example.copper', generation: 1 })
  }, { registryModule, contractModule: `/@fs${contractUrl}` })
}

export async function selectBaselineTheme(page, id, registryModule = `/@fs${registryUrl}`) {
  await page.evaluate(async ({ id, registryModule }) => {
    const { themeRegistry } = await import(registryModule)
    const focused = document.activeElement
    await themeRegistry.selectTheme(id)
    await document.fonts.ready
    if (document.activeElement !== focused) throw new Error(`Theme ${id} changed keyboard focus`)
  }, { id, registryModule })
}

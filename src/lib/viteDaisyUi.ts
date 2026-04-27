import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

type DaisyUiAlias = {
  find: RegExp
  replacement: string
}

type ResolveModule = (id: string) => string

const DAISYUI_PLUGIN_IMPORT = 'daisyui'
const DAISYUI_THEME_PLUGIN_IMPORT = 'daisyui/theme'

/**
 * Vite's production resolver includes browser conditions, so daisyUI's package
 * root can resolve to daisyui.css. Tailwind loads @plugin targets with dynamic
 * import(), which must receive the JavaScript plugin modules instead.
 */
export function createDaisyUiTailwindPluginAliases(resolveModule: ResolveModule = (id) => nodeRequire.resolve(id)): DaisyUiAlias[] {
  return [
    { find: /^daisyui$/, replacement: resolveModule(`${DAISYUI_PLUGIN_IMPORT}/index.js`) },
    { find: /^daisyui\/theme$/, replacement: resolveModule(`${DAISYUI_THEME_PLUGIN_IMPORT}/index.js`) },
  ]
}

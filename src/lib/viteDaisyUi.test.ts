import { describe, expect, it } from 'vitest'

import { createDaisyUiTailwindPluginAliases } from './viteDaisyUi'

function findReplacement(aliases: ReturnType<typeof createDaisyUiTailwindPluginAliases>, id: string): string | undefined {
  const alias = aliases.find((entry) => {
    if (typeof entry.find === 'string') return entry.find === id
    return entry.find.test(id)
  })

  return alias?.replacement
}

describe('createDaisyUiTailwindPluginAliases', () => {
  it('pins daisyUI Tailwind plugin imports to JavaScript entrypoints', () => {
    const aliases = createDaisyUiTailwindPluginAliases()

    expect(findReplacement(aliases, 'daisyui')).toMatch(/daisyui[\\/]index\.js$/)
    expect(findReplacement(aliases, 'daisyui/theme')).toMatch(/daisyui[\\/]theme[\\/]index\.js$/)
    expect(findReplacement(aliases, 'daisyui')).not.toMatch(/daisyui\.css$/)
  })

  it('does not rewrite unrelated daisyUI subpath imports', () => {
    const aliases = createDaisyUiTailwindPluginAliases()

    expect(findReplacement(aliases, 'daisyui/components/button')).toBeUndefined()
  })
})

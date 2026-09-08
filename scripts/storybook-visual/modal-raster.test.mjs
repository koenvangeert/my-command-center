import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { compare } from './comparison.mjs'

const baseline = readFileSync(new URL('./fixtures/modal-raster-noise/baseline.png', import.meta.url))
const current = readFileSync(new URL('./fixtures/modal-raster-noise/current.png', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../../storybook/visual-manifest.json', import.meta.url), 'utf8'))
const modal = manifest.find(entry => entry.catalog === 'components' && entry.story === 'sdk-overlays--modal' && entry.theme === 'openforge-light')

describe('modal raster policy', () => {
  it('keeps the fixed modal exact and rejects the archived pre-fix noise', () => {
    expect(modal.tolerance).toBeUndefined()
    expect(compare(baseline, current, modal.tolerance)).toMatchObject({ pixels: 7, matches: false })
  })

  it('rejects an eighth changed pixel', () => {
    const image = PNG.sync.read(current)
    // Top-left background is unchanged in the archived pair.
    image.data[0] -= 1
    expect(compare(baseline, PNG.sync.write(image), modal.tolerance)).toMatchObject({ pixels: 8, matches: false })
  })

  it('rejects a two-level change even at a single pixel', () => {
    const image = PNG.sync.read(baseline)
    image.data[0] -= 2
    expect(compare(baseline, PNG.sync.write(image), modal.tolerance)).toMatchObject({ pixels: 1, matches: false })
  })

  it('still rejects the archived noise without an explicit allowance', () => {
    expect(compare(baseline, current)).toMatchObject({ pixels: 7, matches: false })
  })
})

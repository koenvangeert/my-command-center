import { describe, it, expect } from 'vitest'
import { validateManifest, validateBaselines, identity } from './manifest.mjs'

const entry = { catalog: 'pages', story: 'pages-focus-board--populated', theme: 'openforge-light', viewport: { width: 1280, height: 800 }, ready: '[aria-label="Task list"]', expectedErrors: [] }
const indexes = { pages: { entries: { [entry.story]: { type: 'story' } } } }
describe('visual manifest contract', () => {
  it('resolves stable identities', () => {
    expect(validateManifest([entry], indexes)).toEqual([entry])
    expect(identity(entry)).toBe('pages/pages-focus-board--populated--openforge-light--1280x800')
  })
  it('accepts a documented two-level rasterization allowance within the pixel cap', () => {
    const bounded = { ...entry, tolerance: { maxPixels: 14, maxChannelDelta: 2, reason: 'Six pinned-container captures differ only at antialiased code-block corners.' } }
    expect(validateManifest([bounded], indexes)).toEqual([bounded])
  })
  it.each([1, 2, 3])('accepts measured two-pixel noise at channel delta %i', (maxChannelDelta) => {
    const measured = { ...entry, tolerance: { maxPixels: 2, maxChannelDelta, reason: 'Measured focused-input corner rasterization' } }
    expect(validateManifest([measured], indexes)).toEqual([measured])
  })
  it.each([[3, 3], [2, 4], [2, 1.5], [2, 0], [0, 3]])('rejects a broader or invalid noise budget %i/%i', (maxPixels, maxChannelDelta) => {
    expect(() => validateManifest([{ ...entry, tolerance: { maxPixels, maxChannelDelta, reason: 'Invalid budget' } }], indexes)).toThrow(/tolerance/)
  })
  it.each([
    [[{ ...entry, catalog: '../escape' }], /catalog/],
    [[{ ...entry, theme: 'unknown' }], /theme/],
    [[{ ...entry, viewport: { width: 0, height: 800 } }], /viewport/],
    [[{ ...entry, ready: '' }], /ready/],
    [[{ ...entry, typo: true }], /unknown/],
    [[{ ...entry, tolerance: { maxPixels: 21, maxChannelDelta: 1, reason: 'too broad' } }], /tolerance/],
    [[{ ...entry, tolerance: { maxPixels: 20, maxChannelDelta: 3, reason: 'too broad' } }], /tolerance/],
    [[{ ...entry, tolerance: { maxPixels: 20, maxChannelDelta: 1, reason: '' } }], /tolerance/],
    [[entry, entry], /duplicate/],
    [[{ ...entry, story: 'missing' }], /missing story/],
  ])('rejects invalid entries', (entries, diagnostic) => {
    expect(() => validateManifest(entries, indexes)).toThrow(diagnostic)
  })
  it('rejects missing, obsolete, and unexpected files without deleting them', () => {
    const name = identity(entry) + '.png'
    expect(() => validateBaselines([entry], [], 'check')).toThrow(/missing baseline/)
    expect(() => validateBaselines([entry], [name, 'pages/old.png'], 'check')).toThrow(/obsolete/)
    expect(() => validateBaselines([entry], [name, 'stray.txt'], 'update')).toThrow(/unexpected/)
    expect(validateBaselines([entry], [name, 'pages/old.png'], 'update')).toEqual(['pages/old.png'])
    expect(validateBaselines([entry], [name], 'check')).toEqual([])
  })
})

import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { identity, validateBaselines, validateManifest } from './manifest.mjs'
import { selectProbeEntries, prepareProbeInputs, withRestoredFile } from './probe-inputs.mjs'

const directories = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

const entries = JSON.parse(await readFile(new URL('../../storybook/visual-manifest.json', import.meta.url), 'utf8'))
const expected = [
  'pages/application-shell--expanded--openforge-light--1280x800',
  'components/components-button--primary--openforge-light--480x240',
]

it('pins both catalogs by full identity independently of manifest order and growth', () => {
  expect(selectProbeEntries(entries).map(identity)).toEqual(expected)
  const unrelated = { ...entries[0], story: 'unrelated-story' }
  expect(selectProbeEntries([unrelated, ...entries].reverse()).map(identity)).toEqual(expected)
})

it('rejects missing and duplicate representatives without falling back to another case', () => {
  expect(() => selectProbeEntries(entries.filter(entry => identity(entry) !== expected[0]))).toThrow(`missing probe identity ${expected[0]}`)
  expect(() => selectProbeEntries([...entries, entries.find(entry => identity(entry) === expected[1])])).toThrow(`duplicate probe identity ${expected[1]}`)
})

it('prepares and resets only matching disposable baselines without mutating the source inventory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'visual-probes-'))
  directories.push(directory)
  const baselineRoot = join(directory, 'approved')
  for (const id of [...expected, 'components/unrelated']) {
    await mkdir(join(baselineRoot, id.split('/')[0]), { recursive: true })
    await writeFile(join(baselineRoot, id + '.png'), id)
  }
  const inputs = await prepareProbeInputs(entries, { baselineRoot, root: join(directory, 'probe') })
  expect(JSON.parse(await readFile(inputs.manifestPath, 'utf8')).map(identity)).toEqual(expected)
  expect(await readdir(join(inputs.baselineRoot, 'components'))).toEqual(['components-button--primary--openforge-light--480x240.png'])
  await writeFile(join(inputs.baselineRoot, expected[0] + '.png'), 'changed')
  await writeFile(join(inputs.baselineRoot, 'obsolete.txt'), 'obsolete')
  await writeFile(inputs.manifestPath, '[]')
  await inputs.reset()
  expect(await readFile(join(inputs.baselineRoot, expected[0] + '.png'), 'utf8')).toBe(expected[0])
  expect(await readdir(inputs.baselineRoot)).toEqual(['components', 'pages'])
  expect(JSON.parse(await readFile(inputs.manifestPath, 'utf8')).map(identity)).toEqual(expected)
  expect(await readFile(join(baselineRoot, expected[0] + '.png'), 'utf8')).toBe(expected[0])
  expect(await readFile(join(baselineRoot, 'components/unrelated.png'), 'utf8')).toBe('components/unrelated')
})

it('restores a mutated build file when a probe assertion throws', async () => {
  const root = await mkdtemp(join(tmpdir(), 'visual-probes-'))
  directories.push(root)
  const path = join(root, 'iframe.html')
  await writeFile(path, 'original')
  const failure = new Error('probe failed')
  await expect(withRestoredFile(path, async original => {
    expect(original).toBe('original')
    await writeFile(path, 'injected failure')
    throw failure
  })).rejects.toBe(failure)
  expect(await readFile(path, 'utf8')).toBe('original')
})

it('normal full-matrix validation rejects invalid cases outside the representative pair', () => {
  const files = entries.map(entry => identity(entry) + '.png')
  const other = entries.find(entry => !expected.includes(identity(entry)))
  expect(() => validateBaselines(entries, files.filter(file => file !== identity(other) + '.png'), 'check')).toThrow('missing baseline')
  expect(() => validateBaselines(entries, [...files, 'components/obsolete.png'], 'check')).toThrow('obsolete baselines')
  expect(() => validateBaselines(entries, [...files, 'unexpected.txt'], 'check')).toThrow('unexpected baseline files')
  const indexes = { pages: { entries: {} }, components: { entries: {} } }
  for (const entry of entries) indexes[entry.catalog].entries[entry.story] = { type: 'story' }
  expect(() => validateManifest([...entries, other], indexes)).toThrow('duplicate identity')
})

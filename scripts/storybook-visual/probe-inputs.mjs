import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { probeRoot } from './inputs.mjs'
import { identity } from './manifest.mjs'

// One page and one visible button. Catalog adoption must not grow runner probes.
const probeIdentities = [
  'pages/application-shell--expanded--openforge-light--1280x800',
  'components/components-button--primary--openforge-light--480x240',
]

export function selectProbeEntries(entries) {
  return probeIdentities.map(id => {
    const matches = entries.filter(entry => identity(entry) === id)
    if (matches.length !== 1) throw new Error(`${matches.length ? 'duplicate' : 'missing'} probe identity ${id}`)
    return matches[0]
  })
}

export async function prepareProbeInputs(entries, { baselineRoot = '/baselines', root = probeRoot } = {}) {
  const selected = selectProbeEntries(entries)
  const destination = join(root, 'baselines')
  const manifestPath = join(root, 'manifest.json')
  async function reset() {
    await rm(root, { recursive: true, force: true })
    for (const entry of selected) {
      const relative = identity(entry) + '.png'
      await mkdir(dirname(join(destination, relative)), { recursive: true })
      await copyFile(join(baselineRoot, relative), join(destination, relative))
    }
    await writeFile(manifestPath, JSON.stringify(selected, null, 2))
  }
  await reset()
  return { entries: selected, baselineRoot: destination, manifestPath, reset }
}

export async function withRestoredFile(path, work) {
  const original = await readFile(path, 'utf8')
  try {
    return await work(original)
  } finally {
    await writeFile(path, original)
  }
}

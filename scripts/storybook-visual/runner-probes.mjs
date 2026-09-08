import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { identity } from './manifest.mjs'
import { prepareProbeInputs, withRestoredFile } from './probe-inputs.mjs'

export async function runnerProbes({ entries, output, timings }) {
  const inputs = await prepareProbeInputs(entries)
  const component = inputs.entries.find(entry => entry.catalog === 'components')
  const componentId = identity(component)
  const json = async path => JSON.parse(await readFile(path, 'utf8'))

  function probe(name, { mode = 'check', status = 0, captures = 2, verify } = {}) {
    return timings.measure('runner-probe', async () => {
      const destination = join(output, 'self-test', name)
      const result = spawnSync(process.execPath, ['scripts/storybook-visual/run.mjs', mode], {
        env: { ...process.env, VISUAL_OUTPUT: destination, VISUAL_BASELINES: inputs.baselineRoot, VISUAL_MANIFEST: inputs.manifestPath },
        encoding: 'utf8', timeout: 120000,
      })
      if (result.error) throw result.error
      assert.equal(result.status, status, result.stdout + result.stderr)
      const timing = await json(join(destination, 'timings.json'))
      assert.equal(timing.captures.attempted, captures, `${name}: bounded capture count`)
      assert.equal(timing.status, status === 0 ? 'passed' : 'failed')
      if (verify) await verify({ ...result, destination, results: await json(join(destination, 'results.json')) })
    }, { id: name })
  }

  // Only disposable build output is injected. Never mutate the repository manifest.
  const htmlPath = 'storybook-static/components/iframe.html'
  await withRestoredFile(htmlPath, async original => {
    await writeFile(htmlPath, original.replace('</head>', '<style>button{background:#ff00ff!important}</style></head>'))
    await probe('intentional-change', { status: 1, verify({ results }) {
      assert.ok(results.some(result => result.id === componentId && result.pixels > 0), 'representative button must exercise the pixel failure')
    } })
    await probe('update-review', { mode: 'update', verify({ results }) {
      assert.ok(results.some(result => result.id === componentId && result.pixels > 0 && result.images.length === 3), 'update must preserve real before/current/difference evidence')
    } })
    await inputs.reset()
    await writeFile(htmlPath, original.replace('</head>', '<script>console.error("disposable unexpected diagnostic")</script></head>'))
    await probe('unexpected-diagnostic', { status: 1, async verify({ results, destination }) {
      const diagnostic = results.find(result => result.id === componentId && result.error?.includes('disposable unexpected diagnostic'))
      assert.ok(diagnostic, 'unexpected diagnostic must fail the real command')
      for (const name of ['baseline', 'current', 'difference']) assert.ok((await readFile(join(destination, diagnostic.id, `${name}.png`))).length > 0)
    } })
  })

  await unlink(join(inputs.baselineRoot, componentId + '.png'))
  await probe('missing-baseline', { status: 1, captures: 0, verify: result => assert.match(result.stderr, /missing baseline/) })
  await inputs.reset()
  for (const [name, diagnostic] of [['components/obsolete.png', /obsolete baselines/], ['unexpected.txt', /unexpected baseline files/]]) {
    const path = join(inputs.baselineRoot, name)
    try {
      await writeFile(path, 'disposable unexpected file')
      await probe(name.endsWith('.png') ? 'obsolete-baseline' : 'unexpected-baseline', { status: 1, captures: 0, verify: result => assert.match(result.stderr, diagnostic) })
    } finally {
      await unlink(path)
    }
  }
  await withRestoredFile(inputs.manifestPath, async () => {
    await writeFile(inputs.manifestPath, JSON.stringify([...inputs.entries, inputs.entries[0]]))
    await probe('duplicate', { status: 1, captures: 0, verify: result => assert.match(result.stderr, /duplicate identity/) })
  })
  await probe('restored')
}

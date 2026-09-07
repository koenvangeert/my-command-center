import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { readFile, writeFile, cp, unlink, mkdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { PNG } from 'pngjs'
import { capture } from './capture.mjs'
import { compare, verifyDiagnostics } from './comparison.mjs'
import { identity } from './manifest.mjs'
import { checkTerminalReadiness, checkTaskCursorStability } from './terminal-readiness.mjs'
import { verifyRepeatedCapture } from './repetition.mjs'

export async function selfTest({ browser, url, entries, output }) {
  for (const entry of entries) {
    const first = await capture(browser, url, entry)
    // Rounded, clipped overlays exposed Chromium's partial-raster corner drift.
    const rasterProbe = ['sdk-overlays--modal', 'pages-task-detail--backlog', 'pages-task-detail--narrow'].includes(entry.story)
    const captures = rasterProbe ? 8 : 2
    verifyDiagnostics(first.diagnostics, entry.expectedErrors)
    for (let attempt = 1; attempt < captures; attempt++) {
      const next = await capture(browser, url, entry)
      verifyDiagnostics(next.diagnostics, entry.expectedErrors)
      await verifyRepeatedCapture(rasterProbe ? { ...entry, tolerance: undefined } : entry, first.bytes, next.bytes, output)
    }
  }
  await checkTerminalReadiness({ browser, url, entries, output })
  await checkTaskCursorStability({ browser, url, entries, output })
  const entry = entries.find(entry => entry.catalog === 'components')
  assert.ok(entry, 'self-test requires a component smoke case')
  await assert.rejects(capture(browser, url, { ...entry, ready: '#missing-readiness' }, { timeout: 3000 }), /missing readiness/)
  const declared = await capture(browser, url, entry, {
    mutate: page => page.evaluate(() => console.error('declared failure')),
  })
  verifyDiagnostics(declared.diagnostics, [...entry.expectedErrors, 'declared failure'])

  const reference = await capture(browser, url, entry)
  const delayed = await capture(browser, url, entry, {
    mutate: async page => {
      await page.evaluate(() => setTimeout(() => {
        const overlay = document.createElement('div')
        overlay.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:99999'
        document.body.append(overlay)
      }, 200))
      await page.waitForTimeout(350)
    },
  })
  verifyDiagnostics(reference.diagnostics, entry.expectedErrors)
  verifyDiagnostics(delayed.diagnostics, entry.expectedErrors)
  assert.equal(compare(reference.bytes, delayed.bytes, entry.tolerance).matches, true, 'wall-clock delay must not advance runtime timers after readiness')

  // CSS animation controls alone cannot freeze inline or image-mask SVG SMIL.
  const motionCaptures = []
  for (const elapsed of [50, 350]) {
    motionCaptures.push(await capture(browser, url, entry, {
      mutate: async page => {
        await page.evaluate(() => {
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="20" height="40"><animate attributeName="x" values="0;80;0" dur="1s" repeatCount="indefinite"/></rect></svg>'
          const probe = document.createElement('div')
          probe.style.cssText = 'position:fixed;left:0;top:0;background:white;z-index:99999'
          probe.innerHTML = svg
          const mask = document.createElement('div')
          mask.style.cssText = 'width:100px;height:40px;background:black'
          mask.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
          probe.append(mask)
          document.body.append(probe)
        })
        await page.waitForTimeout(elapsed)
      },
    }))
  }
  assert.equal(compare(motionCaptures[0].bytes, motionCaptures[1].bytes).matches, true, 'SVG motion must not depend on capture time')
  const maskFrame = PNG.sync.read(motionCaptures[0].bytes)
  const pixel = (x, y) => [...maskFrame.data.subarray((y * maskFrame.width + x) * 4, (y * maskFrame.width + x) * 4 + 3)]
  assert.deepEqual(pixel(90, 60), [0, 0, 0], 'the mask must retain its visible middle keyframe')
  assert.deepEqual(pixel(10, 60), [255, 255, 255], 'the mask must not settle at its empty end frame')
  for (const result of motionCaptures) verifyDiagnostics(result.diagnostics, entry.expectedErrors)

  const terminals = entries.filter(item => item.theme === 'openforge-light' && [
    'pages-task-detail--terminal', 'components-task-workspace-agent-panel--waiting',
  ].includes(item.story))
  for (const terminal of terminals) {
    const first = await capture(browser, url, terminal, { mutate: page => page.waitForTimeout(50) })
    const second = await capture(browser, url, terminal, { mutate: async page => {
      await page.waitForTimeout(700)
      await page.evaluate(() => {
        const input = document.querySelector('.xterm-helper-textarea')
        input.focus()
        requestAnimationFrame(() => input.focus())
      })
      await page.clock.runFor(32)
    } })
    verifyDiagnostics(first.diagnostics, terminal.expectedErrors)
    verifyDiagnostics(second.diagnostics, terminal.expectedErrors)
    assert.equal(compare(first.bytes, second.bytes).matches, true, `${terminal.story}: caret must settle after delayed focus and blink timing`)
  }

  for (const feedback of entries.filter(item => item.story === 'pages-self-review--send-feedback')) {
    const first = await capture(browser, url, feedback)
    const delayed = await capture(browser, url, feedback, { mutate: page => page.waitForTimeout(4000) })
    verifyDiagnostics(first.diagnostics, feedback.expectedErrors)
    verifyDiagnostics(delayed.diagnostics, feedback.expectedErrors)
    assert.equal(compare(first.bytes, delayed.bytes).matches, true, 'feedback success must survive a slow screenshot capture')
  }

  // Repeat the complete matrix above, but keep destructive command-contract probes
  // bounded to one case per catalog as the contributor matrix grows.
  const probeEntries = [entries.find(item => item.catalog === 'pages'), entry].filter(Boolean)
  const manifestPath = 'storybook/visual-manifest.json'
  const manifest = await readFile(manifestPath, 'utf8')
  const htmlPath = 'storybook-static/components/iframe.html'
  const original = await readFile(htmlPath, 'utf8')
  const probeBaselines = '/work/visual-probe-baselines'
  async function restoreProbeBaselines() {
    await rm(probeBaselines, { recursive: true, force: true })
    for (const item of probeEntries) {
      const path = join(probeBaselines, identity(item) + '.png')
      await mkdir(dirname(path), { recursive: true })
      await cp(join('/baselines', identity(item) + '.png'), path)
    }
  }
  function probe(name, mode = 'check') {
    const destination = join(output, 'self-test', name)
    const result = spawnSync(process.execPath, ['scripts/storybook-visual/run.mjs', mode], {
      // Child commands capture only the selected per-catalog probe cases.
      env: { ...process.env, VISUAL_OUTPUT: destination, VISUAL_BASELINES: probeBaselines }, encoding: 'utf8', timeout: Math.max(120000, probeEntries.length * 30000),
    })
    if (result.error) throw result.error
    return { ...result, destination }
  }
  try {
    await writeFile(manifestPath, JSON.stringify(probeEntries))
    await restoreProbeBaselines()
    try {
      await writeFile(htmlPath, original.replace('</head>', '<style>button{background:#ff00ff!important}</style></head>'))
      const changed = probe('intentional-change')
      assert.equal(changed.status, 1, changed.stdout + changed.stderr)
      const changedResults = JSON.parse(await readFile(join(changed.destination, 'results.json'), 'utf8'))
      assert.ok(changedResults.some(result => result.pixels > 0), 'disposable change must fail with a pixel difference')
      const updated = probe('update-review', 'update')
      assert.equal(updated.status, 0, updated.stdout + updated.stderr)
      const updateResults = JSON.parse(await readFile(join(updated.destination, 'results.json'), 'utf8'))
      assert.ok(updateResults.some(result => result.pixels > 0 && result.images.length === 3), 'update must preserve real before/current/difference evidence')
      await restoreProbeBaselines()
      await writeFile(htmlPath, original.replace('</head>', '<script>console.error("disposable unexpected diagnostic")</script></head>'))
      const failed = probe('unexpected-diagnostic')
      assert.equal(failed.status, 1, failed.stdout + failed.stderr)
      const failedResults = JSON.parse(await readFile(join(failed.destination, 'results.json'), 'utf8'))
      const diagnostic = failedResults.find(result => result.error?.includes('disposable unexpected diagnostic'))
      assert.ok(diagnostic, 'unexpected diagnostic must fail the real command')
      for (const name of ['baseline', 'current', 'difference']) {
        assert.ok((await readFile(join(failed.destination, diagnostic.id, `${name}.png`))).length > 0)
      }
    } finally {
      await writeFile(htmlPath, original)
    }
    await unlink(join(probeBaselines, identity(entry) + '.png'))
    const missing = probe('missing-baseline')
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /missing baseline/)
    await restoreProbeBaselines()
    for (const [name, diagnostic] of [['components/obsolete.png', /obsolete baselines/], ['unexpected.txt', /unexpected baseline files/]]) {
      const path = join(probeBaselines, name)
      try {
        await writeFile(path, 'disposable unexpected file')
        const invalid = probe(name.endsWith('.png') ? 'obsolete-baseline' : 'unexpected-baseline')
        assert.equal(invalid.status, 1)
        assert.match(invalid.stderr, diagnostic)
      } finally {
        await unlink(path)
      }
    }
    await writeFile(manifestPath, JSON.stringify([...probeEntries, entry]))
    const duplicate = probe('duplicate')
    assert.equal(duplicate.status, 1)
    assert.match(duplicate.stderr, /duplicate identity/)
    await writeFile(manifestPath, JSON.stringify(probeEntries))
    const restored = probe('restored')
    assert.equal(restored.status, 0, restored.stdout + restored.stderr)
  } finally {
    await writeFile(manifestPath, manifest)
  }
  console.log(`Self-test passed: ${entries.length} cases repeat, SVG motion, disposable pixel failure, update evidence, diagnostic artifacts, readiness, exact diagnostics, and restoration`)
}

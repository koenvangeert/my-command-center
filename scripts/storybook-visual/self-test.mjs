import assert from 'node:assert/strict'
import { capture } from './capture.mjs'
import { verifyDiagnostics } from './comparison.mjs'
import { checkTerminalReadiness, checkTaskCursorStability } from './terminal-readiness.mjs'
import { verifyRepeatFromInitial } from './repetition.mjs'
import { runnerProbes } from './runner-probes.mjs'
import { checkCaptureStability } from './capture-stability.mjs'

export async function selfTest({ browser, url, entries, output, timings }) {
  await timings.measure('repeatability', async () => {
    for (const entry of entries) {
      await verifyRepeatFromInitial(entry, output, () => capture(browser, url, entry, { timings, phase: 'repeatability' }))
    }
  })
  await timings.measure('terminal-readiness', () => checkTerminalReadiness({ browser, url, entries, output, timings }))
  await timings.measure('cursor-stability', () => checkTaskCursorStability({ browser, url, entries, output, timings }))
  await timings.measure('readiness-diagnostics', async () => {
    const entry = entries.find(entry => entry.catalog === 'components')
    assert.ok(entry, 'self-test requires a component smoke case')
    await assert.rejects(capture(browser, url, { ...entry, ready: '#missing-readiness' }, { timeout: 3000, timings, phase: 'missing-readiness' }), /missing readiness/)
    const declared = await capture(browser, url, entry, {
      timings, phase: 'declared-diagnostic',
      mutate: page => page.evaluate(() => console.error('declared failure')),
    })
    verifyDiagnostics(declared.diagnostics, [...entry.expectedErrors, 'declared failure'])
  })
  await timings.measure('capture-stability', () => checkCaptureStability({ browser, url, entries, output, timings }))
  await timings.measure('runner-probes', () => runnerProbes({ entries, output, timings }))
  console.log(`Self-test passed: ${entries.length} cases repeat, raster and SVG motion, disposable pixel failure, update evidence, diagnostic artifacts, readiness, exact diagnostics, and restoration`)
}

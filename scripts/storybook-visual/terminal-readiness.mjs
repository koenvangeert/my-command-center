import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { capture } from './capture.mjs'
import { compare, verifyDiagnostics } from './comparison.mjs'
import { identity } from './manifest.mjs'
import { verifyRepeatedCapture } from './repetition.mjs'

const overflowStories = ['components-terminal-tabs--overflow', 'components-terminal-runtime--overflow']

/** Exercise production replay, presentation drain and the 12-click play path in Chromium. */
export async function checkTerminalReadiness({ browser, url, entries, output, baselineRoot = '/baselines', timings }) {
  const selected = overflowStories.map(story => {
    const entry = entries.find(entry => entry.story === story)
    assert.ok(entry, `Terminal readiness regression requires ${story}`)
    return entry
  })
  const directory = join(output, 'self-test', 'terminal-readiness')
  await mkdir(directory, { recursive: true })
  const contextsBefore = browser.contexts().length
  const results = []
  try {
    for (const rate of [1, 4]) {
      for (let repetition = 0; repetition < 3; repetition++) {
        for (const entry of selected) {
          const started = performance.now()
          const result = { story: entry.story, rate, repetition }
          results.push(result)
          try {
            const current = await capture(browser, url, entry, {
              timings, phase: 'terminal-readiness',
              async prepare(page) {
                const session = await page.context().newCDPSession(page)
                await session.send('Emulation.setCPUThrottlingRate', { rate })
              },
              async mutate(page) {
                result.progress = JSON.parse(await page.locator('[data-terminal-progress]').getAttribute('data-terminal-progress'))
                result.tabs = await page.getByRole('tab').count()
              },
            })
            verifyDiagnostics(current.diagnostics, entry.expectedErrors)
            assert.equal(result.progress.at(-1).phase, 'ready')
            // Earlier waitFor attempts can drain before a replay is queued.
            // Assert the proof that actually completed readiness, not a failed text attempt.
            const proof = result.progress.findLast(step => step.phase === 'text')?.evidence
            assert.ok(proof, 'Readiness must include a production presentation drain')
            assert.equal(proof.parsedGeneration, proof.writeGeneration)
            assert.ok(proof.renderFrame > 0)
            if (entry.story === overflowStories[0]) assert.equal(result.tabs, 12)
            const baseline = await readFile(join(baselineRoot, identity(entry) + '.png'))
            const comparison = compare(baseline, current.bytes, entry.tolerance)
            result.pixels = comparison.pixels
            if (!comparison.matches) {
              const name = `${entry.story}-${rate}-${repetition}`
              await writeFile(join(directory, `${name}-current.png`), current.bytes)
              await writeFile(join(directory, `${name}-difference.png`), comparison.difference)
            }
            assert.equal(comparison.matches, true, `${entry.story}: CPU ${rate}x capture must match the approved baseline`)
          } catch (error) {
            result.error = error.message
            throw error
          } finally {
            result.elapsedMs = Math.round(performance.now() - started)
          }
        }
      }
    }

    // A real missing paint callback must fail, not publish readiness. The page
    // context owns this fault injection and is closed even while drain is pending.
    await assert.rejects(capture(browser, url, selected[1], {
      timings, phase: 'withheld-paint',
      timeout: 3000,
      prepare: page => page.addInitScript(() => {
        const requestFrame = window.requestAnimationFrame.bind(window)
        window.requestAnimationFrame = callback => requestFrame(time => {
          const progress = JSON.parse(document.querySelector('[data-terminal-progress]')?.getAttribute('data-terminal-progress') ?? '[]')
          if (progress.at(-1)?.phase !== 'drain') callback(time)
        })
      }),
    }), error => {
      const evidence = JSON.parse(error.message.split('Readiness evidence: ')[1])
      const progress = JSON.parse(evidence.terminals[0].progress)
      assert.equal(progress.at(-1).phase, 'drain')
      assert.equal(progress.at(-1).key, 'T-42-shell-0')
      assert.match(error.message, /missing readiness/)
      results.push({ fault: 'withheld-paint', evidence })
      return true
    })

    const active = entries.find(entry => entry.story === 'pages-task-detail--active')
    assert.ok(active, 'Task Detail readiness regression requires the active story')
    await assert.rejects(capture(browser, url, active, {
      timings, phase: 'task-detail-withheld-paint',
      timeout: 3000,
      prepare: page => page.addInitScript(() => {
        const requestFrame = window.requestAnimationFrame.bind(window)
        window.requestAnimationFrame = callback => requestFrame(time => {
          const progress = JSON.parse(document.querySelector('[data-terminal-progress]')?.getAttribute('data-terminal-progress') ?? '[]')
          if (progress.at(-1)?.phase !== 'drain') callback(time)
        })
      }),
    }), error => {
      const evidence = JSON.parse(error.message.split('Readiness evidence: ')[1])
      const progress = JSON.parse(evidence.terminals[0].progress)
      const last = progress.at(-1)
      assert.equal(last.phase, 'drain')
      assert.ok(last.key)
      assert.equal(last.state.shellSessionKey, last.key)
      assert.equal(last.state.view.attached, true)
      assert.equal(last.state.view.authorityReadPending, false)
      assert.ok(progress.length <= 20)
      assert.ok(evidence.tabs.count > 0)
      assert.match(evidence.tabs.selected, /Agent/i)
      assert.match(error.message, /missing readiness/)
      results.push({ fault: 'task-detail-withheld-paint', evidence })
      return true
    })
  } finally {
    await writeFile(join(directory, 'results.json'), JSON.stringify(results, null, 2))
    assert.equal(browser.contexts().length, contextsBefore, 'Terminal readiness probes must close every context')
  }
}

/** Observe replay through multiple cursor-blink phases; this is not a readiness delay. */
export async function checkTaskCursorStability({ browser, url, entries, output, timings }) {
  const selected = entries.filter(entry => entry.story === 'pages-task-detail--active')
  assert.ok(selected.length, 'Cursor regression requires the active Task Detail story')
  for (const entry of selected) {
    const current = await capture(browser, url, entry, {
      timings, phase: 'cursor-stability',
      async mutate(page) {
        const screen = page.locator('.xterm-screen').first()
        const options = { animations: 'disabled', caret: 'hide', scale: 'css' }
        const first = await screen.screenshot(options)
        // xterm blinks every 600ms. Two 650ms samples expose both phases.
        for (let sample = 0; sample < 2; sample++) {
          await page.waitForTimeout(650)
          const next = await screen.screenshot(options)
          await verifyRepeatedCapture({ ...entry, tolerance: undefined }, first, next, output)
        }
      },
    })
    verifyDiagnostics(current.diagnostics, entry.expectedErrors)
  }
}

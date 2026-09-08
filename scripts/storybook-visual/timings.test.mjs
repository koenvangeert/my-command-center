import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTimings } from './timings.mjs'

const directories = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

it('reports elapsed wall time separately from nested captures and bounds slowest-capture logs', async () => {
  const output = await mkdtemp(join(tmpdir(), 'visual-timing-'))
  directories.push(output)
  let clock = 100
  const logs = []
  const timings = createTimings({ output, now: () => clock, log: line => logs.push(line) })
  await timings.measure('baseline', async () => {
    for (let index = 0; index < 7; index++) {
      await timings.measure('baseline', async () => { clock += 10 }, { id: `case-${index}`, capture: true })
    }
    clock += 5
  })
  clock += 5
  await timings.finish('passed')
  const evidence = JSON.parse(await readFile(join(output, 'timings.json'), 'utf8'))
  expect(evidence).toMatchObject({ status: 'passed', elapsedMs: 80, captures: { attempted: 7, completed: 7, failed: 0 } })
  expect(evidence.records[0]).toEqual({ phase: 'baseline', status: 'passed', elapsedMs: 75 })
  expect(evidence.records[1]).toEqual({ phase: 'baseline', id: 'case-0', capture: true, status: 'passed', elapsedMs: 10 })
  expect(logs.filter(line => line.startsWith('Slow capture:'))).toHaveLength(5)
  expect(logs).toContain('Phase baseline: started')
  expect(logs).toContain('Phase baseline: passed (75ms)')
})

it('retains failed capture and phase durations without replacing the original error', async () => {
  const output = await mkdtemp(join(tmpdir(), 'visual-timing-'))
  directories.push(output)
  let clock = 0
  const timings = createTimings({ output, now: () => clock, log: () => {} })
  const failure = new Error('missing readiness')
  await expect(timings.measure('repeatability', () => timings.measure('repeatability', async () => {
    clock = 25
    throw failure
  }, { id: 'unstable', capture: true }))).rejects.toBe(failure)
  await timings.finish('failed')
  const evidence = JSON.parse(await readFile(join(output, 'timings.json'), 'utf8'))
  expect(evidence).toMatchObject({ status: 'failed', elapsedMs: 25, captures: { attempted: 1, completed: 0, failed: 1 } })
  expect(evidence.records).toEqual([
    { phase: 'repeatability', status: 'failed', elapsedMs: 25 },
    { phase: 'repeatability', id: 'unstable', capture: true, status: 'failed', elapsedMs: 25 },
  ])
})

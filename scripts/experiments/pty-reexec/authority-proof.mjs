#!/usr/bin/env node
// Release-blocking behavioral probe. A failure is evidence, never a passing baseline.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import xterm from '@xterm/xterm'
const { Terminal } = xterm
import { prepareGhosttyVt } from '../../prepare-ghostty-vt.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const env = { ...process.env, ...await prepareGhosttyVt() }
const result = spawnSync('cargo', [
  'run', '--offline', '--locked', '--manifest-path',
  'scripts/experiments/pty-reexec/authority/Cargo.toml',
], { cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? '')
  throw result.error ?? new Error(`Authority fixture failed to run: ${result.status}`)
}
const write = (terminal, bytes) => new Promise(resolve => terminal.write(Uint8Array.from(bytes), resolve))
function state(terminal) {
  const buffer = terminal.buffer.active
  return {
    type: buffer.type, cursorX: buffer.cursorX, cursorY: buffer.cursorY,
    rows: Array.from({ length: terminal.rows }, (_, y) => {
      const line = buffer.getLine(buffer.baseY + y)
      return Array.from({ length: terminal.cols }, (_, x) => {
        const cell = line.getCell(x)
        return [cell.getChars(), cell.getWidth(), cell.getFgColorMode(), cell.getFgColor()]
      })
    }),
  }
}
const cases = []
for (const fixture of JSON.parse(result.stdout)) {
  const live = new Terminal({ cols: 20, rows: 4, allowProposedApi: true })
  const recovered = new Terminal({ cols: 20, rows: 4, allowProposedApi: true })
  try {
    await write(live, fixture.prefix)
    await write(live, fixture.suffix)
    // Current TerminalTransport recovery contract, as consumed by
    // xtermTerminalView.replaceSnapshot: reset, compatibility, portable VT,
    // then only output newer than the captured actor watermark.
    recovered.reset()
    await write(recovered, fixture.compatibilityData)
    await write(recovered, fixture.data)
    await write(recovered, fixture.suffix)
    const expected = state(live)
    const actual = state(recovered)
    let mismatch = null
    try { assert.deepEqual(actual, expected) } catch (error) { mismatch = error.message }
    cases.push({ name: fixture.name, codecMatches: fixture.codecMatches,
      checkpointBytes: fixture.checkpointBytes, watermark: fixture.watermark,
      prefixBytes: fixture.prefix.length, suffixBytes: fixture.suffix.length,
      acceptedReplies: fixture.acceptedReplies, continuedReplies: fixture.continuedReplies,
      presentationMatches: mismatch === null, expected, actual, mismatch })
  } finally { live.dispose(); recovered.dispose() }
}
const files = [
  'src-tauri/src/terminal_model.rs', 'src-tauri/src/terminal_model/session.rs',
  'src-tauri/src/terminal_model/worker_session.rs', 'src-tauri/src/terminal_model/event_state.rs',
  'packages/terminal-runtime/src/xtermTerminalView.ts', 'pnpm-lock.yaml',
  'scripts/experiments/pty-reexec/authority/src/main.rs',
  'scripts/experiments/pty-reexec/authority/Cargo.lock',
  'scripts/experiments/pty-reexec/authority-proof.mjs',
]
const report = {
  platform: process.platform, architecture: process.arch,
  passed: cases.every(item => item.codecMatches && item.presentationMatches),
  scope: 'Authority codec and renderer recovery contract only; no live PTY replacement in this probe.',
  sources: Object.fromEntries(files.map(path => [path,
    createHash('sha256').update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest('hex')])),
  cases,
}
const reportPath = process.argv[2]
if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
for (const item of cases) console.log(`${item.name}: codec=${item.codecMatches}, presentation=${item.presentationMatches}`)
process.exitCode = report.passed ? 0 : 1

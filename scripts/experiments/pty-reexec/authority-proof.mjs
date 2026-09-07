#!/usr/bin/env node
// Release-blocking behavioral probe. A failure is evidence, never a passing baseline.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'vite'
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

// Bundle the production view unchanged, including the actual xterm implementation.
// JSDOM supplies a DOM, not a mounted desktop renderer or a pixel-presentation proof.
const dom = new JSDOM('', { pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLCanvasElement',
  'ImageData', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (dom.window[key]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
}
const bundles = await build({
  root, configFile: false, logLevel: 'error',
  build: {
    write: false,
    lib: { entry: 'packages/terminal-runtime/src/xtermTerminalView.ts', formats: ['es'] },
    rolldownOptions: { output: { codeSplitting: false } },
  },
})
const code = bundles[0].output.find(item => item.type === 'chunk').code
const { createXtermTerminalView } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

function presentation() {
  let parsed = () => {}
  const replies = []
  const view = createXtermTerminalView({
    terminalKey: 'authority-proof', themeMode: 'dark', enableImages: false,
    fontReadiness: { status: 'ready' }, openLink: async () => {},
    performanceTrace: { recordWrite() {}, mark(name) { if (name === 'xtermParse') parsed() } },
  })
  view.onUserInput(data => replies.push(data))
  return {
    view, replies,
    write(bytes, sequence) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Renderer parsing timed out')), 5000)
        parsed = () => { clearTimeout(timeout); resolve() }
        view.writeLive({ data: Uint8Array.from(bytes), ptyInstanceId: 1, sequence })
      })
    },
  }
}
const cases = []
try {
  for (const fixture of JSON.parse(result.stdout)) {
    const live = presentation()
    const recovered = presentation()
    try {
      await live.write(fixture.prefix, 1)
      await live.write(fixture.suffix, 2)
      await recovered.view.replaceSnapshot({
        data: Uint8Array.from(fixture.data),
        compatibilityData: Uint8Array.from(fixture.compatibilityData),
        continuationData: Uint8Array.from(fixture.continuationData),
        ptyInstanceId: 1, sequence: fixture.watermark,
      })
      await recovered.write(fixture.suffix, fixture.watermark + 1)
      const expected = live.view.capturePresentation()
      const actual = recovered.view.capturePresentation()
      let mismatch = null
      try {
        assert.deepEqual(actual, expected)
        assert.deepEqual(recovered.replies, [])
        assert.deepEqual(live.replies, [])
      } catch (error) { mismatch = error.message }
      cases.push({ name: fixture.name, codecMatches: fixture.codecMatches,
        checkpointBytes: fixture.checkpointBytes, watermark: fixture.watermark,
        prefixBytes: fixture.prefix.length, suffixBytes: fixture.suffix.length,
        continuationBytes: fixture.continuationData.length,
        acceptedReplies: fixture.acceptedReplies, continuedReplies: fixture.continuedReplies,
        rendererReplies: recovered.replies,
        presentationMatches: mismatch === null, expected, actual, mismatch })
    } finally { live.view.dispose(); recovered.view.dispose() }
  }
} finally { dom.window.close() }
const files = [
  'src-tauri/src/terminal_model.rs', 'src-tauri/src/terminal_model/session.rs',
  'src-tauri/src/terminal_model/worker_session.rs', 'src-tauri/src/terminal_model/event_state.rs',
  'packages/terminal-runtime/src/xtermTerminalView.ts', 'packages/terminal-runtime/src/terminalView.ts',
  'packages/terminal-runtime/src/xtermPresentation.ts', 'pnpm-lock.yaml',
  'scripts/experiments/pty-reexec/authority/src/main.rs',
  'scripts/experiments/pty-reexec/authority/Cargo.lock',
  'scripts/experiments/pty-reexec/authority-proof.mjs',
]
const report = {
  platform: process.platform, architecture: process.arch,
  passed: cases.every(item => item.codecMatches && item.presentationMatches),
  scope: 'Actual Ghostty actor and production xterm TerminalView recovery in JSDOM. No mounted desktop, images, IPC or live PTY replacement in this probe.',
  sources: Object.fromEntries(files.map(path => [path,
    createHash('sha256').update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest('hex')])),
  rendererBundleHash: createHash('sha256').update(code).digest('hex'),
  cases,
}
const reportPath = process.argv[2]
if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
for (const item of cases) console.log(`${item.name}: codec=${item.codecMatches}, presentation=${item.presentationMatches}`)
process.exitCode = report.passed ? 0 : 1

#!/usr/bin/env node
import { spawn } from 'node:child_process'

import { buildTauriDevEnv } from './tauri-dev-env.mjs'

const { cargoTargetDir, env, source } = buildTauriDevEnv()
const sourceLabel = source === 'env' ? 'existing CARGO_TARGET_DIR' : source === 'git-common-dir' ? 'git common dir' : 'fallback'

console.log(`[tauri:dev] using Cargo target dir (${sourceLabel}): ${cargoTargetDir}`)

const child = spawn('pnpm', ['exec', 'tauri', 'dev', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error(`[tauri:dev] failed to start Tauri dev: ${error.message}`)
  process.exit(1)
})

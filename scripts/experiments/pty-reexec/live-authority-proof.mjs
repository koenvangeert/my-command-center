#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareGhosttyVt } from '../../prepare-ghostty-vt.mjs'

if (process.platform !== 'darwin') throw new Error('This proof requires macOS')
const cwd = fileURLToPath(new URL('../../../', import.meta.url))
const env = { ...process.env, ...await prepareGhosttyVt() }
const manifest = 'scripts/experiments/pty-reexec/authority/Cargo.toml'
const build = spawnSync('cargo', ['build', '--offline', '--locked', '--bins', '--manifest-path', manifest], {
  cwd, env, stdio: 'inherit',
})
if (build.status !== 0) throw build.error ?? new Error(`Authority build failed: ${build.status}`)
const metadata = spawnSync('cargo', ['metadata', '--offline', '--locked', '--no-deps', '--format-version=1', '--manifest-path', manifest], {
  cwd, env, encoding: 'utf8',
})
if (metadata.status !== 0) throw metadata.error ?? new Error(metadata.stderr)
const binDir = join(JSON.parse(metadata.stdout).target_directory, 'debug')
const test = spawnSync('python3', ['scripts/experiments/pty-reexec/live_authority.py', '--bin-dir', binDir, ...process.argv.slice(2)], {
  cwd, env, stdio: 'inherit',
})
if (test.error) throw test.error
process.exitCode = test.status ?? 1

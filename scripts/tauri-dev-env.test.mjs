import { describe, expect, it } from 'vitest'
import path from 'node:path'

import {
  buildTauriDevEnv,
  computeCargoTargetDir,
  resolveGitCommonDir,
  sharedCargoTargetDirFromGitCommonDir,
} from './tauri-dev-env.mjs'

describe('tauri dev shared Cargo target env', () => {
  it('resolves relative git common dirs from the current worktree', () => {
    expect(resolveGitCommonDir('/repo/worktrees/KVG-820', '../../main/.git')).toBe(
      path.resolve('/repo/worktrees/KVG-820', '../../main/.git'),
    )
  })

  it('places shared target beside a non-bare .git directory', () => {
    expect(sharedCargoTargetDirFromGitCommonDir('/repo/main/.git')).toBe(
      path.join('/repo/main', '.cargo-target'),
    )
  })

  it('places shared target inside a non-standard common git directory', () => {
    expect(sharedCargoTargetDirFromGitCommonDir('/repo/main/git-common')).toBe(
      path.join('/repo/main/git-common', 'openforge-cargo-target'),
    )
  })

  it('keeps an explicit CARGO_TARGET_DIR unchanged', () => {
    const result = computeCargoTargetDir({
      cwd: '/repo/worktree',
      env: { CARGO_TARGET_DIR: '/custom/target' },
      execFileSync: () => {
        throw new Error('git should not be consulted')
      },
    })

    expect(result).toEqual({ cargoTargetDir: '/custom/target', source: 'env' })
  })

  it('uses the git common dir to share Rust artifacts across worktrees', () => {
    const result = computeCargoTargetDir({
      cwd: '/repo/worktrees/KVG-820',
      env: {},
      execFileSync: () => '../main/.git\n',
    })

    expect(result).toEqual({
      cargoTargetDir: path.resolve('/repo/worktrees/KVG-820', '../main/.cargo-target'),
      source: 'git-common-dir',
    })
  })

  it('falls back to the existing src-tauri target dir outside git', () => {
    const result = computeCargoTargetDir({
      cwd: '/repo/openforge',
      env: {},
      execFileSync: () => {
        throw new Error('not a git checkout')
      },
    })

    expect(result).toEqual({
      cargoTargetDir: path.join('/repo/openforge', 'src-tauri', 'target'),
      source: 'fallback',
    })
  })

  it('returns an environment object with CARGO_TARGET_DIR set', () => {
    const result = buildTauriDevEnv({
      cwd: '/repo/worktrees/KVG-820',
      env: { PATH: '/bin' },
      execFileSync: () => '../main/.git\n',
    })

    expect(result.env).toMatchObject({
      PATH: '/bin',
      CARGO_TARGET_DIR: path.resolve('/repo/worktrees/KVG-820', '../main/.cargo-target'),
    })
    expect(result.source).toBe('git-common-dir')
  })
})

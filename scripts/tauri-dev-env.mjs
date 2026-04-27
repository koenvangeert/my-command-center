import { execFileSync as defaultExecFileSync } from 'node:child_process'
import path from 'node:path'

const FALLBACK_RUST_TARGET_DIR = path.join('src-tauri', 'target')
const SHARED_TARGET_DIR_NAME = '.cargo-target'
const NON_STANDARD_COMMON_DIR_TARGET_NAME = 'openforge-cargo-target'

export function resolveGitCommonDir(cwd, gitCommonDir) {
  return path.normalize(path.isAbsolute(gitCommonDir) ? gitCommonDir : path.resolve(cwd, gitCommonDir))
}

export function sharedCargoTargetDirFromGitCommonDir(gitCommonDir) {
  const normalizedGitCommonDir = path.normalize(gitCommonDir)

  if (path.basename(normalizedGitCommonDir) === '.git') {
    return path.join(path.dirname(normalizedGitCommonDir), SHARED_TARGET_DIR_NAME)
  }

  return path.join(normalizedGitCommonDir, NON_STANDARD_COMMON_DIR_TARGET_NAME)
}

export function computeCargoTargetDir({
  cwd = process.cwd(),
  env = process.env,
  execFileSync = defaultExecFileSync,
} = {}) {
  if (env.CARGO_TARGET_DIR) {
    return { cargoTargetDir: env.CARGO_TARGET_DIR, source: 'env' }
  }

  try {
    const gitCommonDir = resolveGitCommonDir(
      cwd,
      String(
        execFileSync('git', ['rev-parse', '--git-common-dir'], {
          cwd,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }),
      ).trim(),
    )

    return {
      cargoTargetDir: sharedCargoTargetDirFromGitCommonDir(gitCommonDir),
      source: 'git-common-dir',
    }
  } catch {
    return {
      cargoTargetDir: path.resolve(cwd, FALLBACK_RUST_TARGET_DIR),
      source: 'fallback',
    }
  }
}

export function buildTauriDevEnv(options = {}) {
  const env = options.env ?? process.env
  const result = computeCargoTargetDir({ ...options, env })

  return {
    ...result,
    env: {
      ...env,
      CARGO_TARGET_DIR: result.cargoTargetDir,
    },
  }
}

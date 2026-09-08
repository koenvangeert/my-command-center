export const probeRoot = '/work/visual-probe'

// This is an internal child-command contract, not a public case filter.
// Validate the complete tuple before run.mjs performs any filesystem writes.
export function resolveVisualInputs(mode, env) {
  const overrides = [env.VISUAL_OUTPUT, env.VISUAL_BASELINES, env.VISUAL_MANIFEST]
  if (overrides.every(value => value === undefined)) {
    return { output: '/output', baselineRoot: '/baselines', manifestPath: 'storybook/visual-manifest.json' }
  }
  if (!['check', 'update'].includes(mode) ||
    !/^\/output\/self-test\/[a-z-]+$/.test(env.VISUAL_OUTPUT ?? '') ||
    env.VISUAL_BASELINES !== `${probeRoot}/baselines` ||
    env.VISUAL_MANIFEST !== `${probeRoot}/manifest.json`) throw new Error('invalid probe inputs')
  return { output: env.VISUAL_OUTPUT, baselineRoot: env.VISUAL_BASELINES, manifestPath: env.VISUAL_MANIFEST }
}

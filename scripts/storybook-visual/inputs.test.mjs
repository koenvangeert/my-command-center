import { expect, it } from 'vitest'
import { resolveVisualInputs } from './inputs.mjs'

const probe = {
  VISUAL_OUTPUT: '/output/self-test/intentional-change',
  VISUAL_BASELINES: '/work/visual-probe/baselines',
  VISUAL_MANIFEST: '/work/visual-probe/manifest.json',
}

it.each(['check', 'update', 'test'])('keeps %s on the full repository inputs by default', mode => {
  expect(resolveVisualInputs(mode, {})).toEqual({ output: '/output', baselineRoot: '/baselines', manifestPath: 'storybook/visual-manifest.json' })
})

it.each(['check', 'update'])('allows the complete disposable input set only in child %s mode', mode => {
  expect(resolveVisualInputs(mode, probe)).toEqual({ output: probe.VISUAL_OUTPUT, baselineRoot: probe.VISUAL_BASELINES, manifestPath: probe.VISUAL_MANIFEST })
})

it('rejects incomplete, escaping, and normal-output probe overrides', () => {
  for (const key of Object.keys(probe)) {
    const incomplete = { ...probe }
    delete incomplete[key]
    expect(() => resolveVisualInputs('check', incomplete)).toThrow('invalid probe inputs')
    expect(() => resolveVisualInputs('check', { [key]: probe[key] })).toThrow('invalid probe inputs')
    expect(() => resolveVisualInputs('check', { ...probe, [key]: '' })).toThrow('invalid probe inputs')
  }
  for (const invalid of [
    { VISUAL_MANIFEST: 'storybook/visual-manifest.json' },
    { VISUAL_MANIFEST: '/work/visual-probe/../manifest.json' },
    { VISUAL_BASELINES: '/baselines' },
    { VISUAL_OUTPUT: '/output' },
    { VISUAL_OUTPUT: '/output/self-test/../escaped' },
  ]) expect(() => resolveVisualInputs('check', { ...probe, ...invalid })).toThrow('invalid probe inputs')
  expect(() => resolveVisualInputs('test', probe)).toThrow('invalid probe inputs')
})

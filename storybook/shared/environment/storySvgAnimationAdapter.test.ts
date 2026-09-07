import { afterEach, expect, it } from 'vitest'
import { createStorySvgAnimationAdapter } from './storySvgAnimationAdapter'

function animatedSvg(initialTime = 7, initiallyPaused = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.append(document.createElementNS('http://www.w3.org/2000/svg', 'animate'))
  // jsdom has no SMIL engine. Model its public timeline API for lifecycle checks;
  // navigation.browser.test.ts verifies actual Chromium timelines.
  let time = initialTime
  let paused = initiallyPaused
  svg.getCurrentTime = () => time
  svg.setCurrentTime = value => { time = value }
  svg.animationsPaused = () => paused
  svg.pauseAnimations = () => { paused = true }
  svg.unpauseAnimations = () => { paused = false }
  document.body.append(svg)
  return svg
}
afterEach(() => { document.body.replaceChildren() })

it('freezes existing and later SVG timelines, resets time, and restores them on disposal', async () => {
  const existing = animatedSvg()
  const adapter = createStorySvgAnimationAdapter(document)
  try {
    adapter.install()
    expect([existing.animationsPaused(), existing.getCurrentTime()]).toEqual([true, 0])
    const later = animatedSvg(3, true)
    await Promise.resolve()
    expect([later.animationsPaused(), later.getCurrentTime()]).toEqual([true, 0])
    existing.setCurrentTime(9)
    adapter.reset()
    expect(existing.getCurrentTime()).toBe(0)
    adapter.dispose()
    expect([existing.animationsPaused(), existing.getCurrentTime()]).toEqual([false, 7])
    expect([later.animationsPaused(), later.getCurrentTime()]).toEqual([true, 3])
    const after = animatedSvg()
    await Promise.resolve()
    expect([after.animationsPaused(), after.getCurrentTime()]).toEqual([false, 7])
  } finally { adapter.dispose() }
})

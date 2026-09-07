import type { StoryEnvironmentAdapter } from './storyEnvironment'

/** CSS motion controls do not stop SVG's independent SMIL timelines. */
export function createStorySvgAnimationAdapter(document: Document): StoryEnvironmentAdapter {
  const timelines = new Map<SVGSVGElement, { paused: boolean; time: number }>()
  let observer: MutationObserver | undefined

  function freeze(): void {
    for (const svg of timelines.keys()) if (!svg.isConnected) timelines.delete(svg)
    for (const svg of document.querySelectorAll<SVGSVGElement>('svg')) {
      if (!svg.querySelector('animate, animateTransform, animateMotion, set') || typeof svg.pauseAnimations !== 'function') continue
      if (!timelines.has(svg)) timelines.set(svg, { paused: svg.animationsPaused(), time: svg.getCurrentTime() })
      svg.pauseAnimations()
      svg.setCurrentTime(0)
    }
  }

  return {
    install() {
      if (observer) return
      freeze()
      observer = new MutationObserver(freeze)
      observer.observe(document.documentElement, { childList: true, subtree: true })
    },
    reset: freeze,
    dispose() {
      observer?.disconnect()
      observer = undefined
      for (const [svg, original] of timelines) {
        if (!svg.isConnected) continue
        svg.setCurrentTime(original.time)
        if (!original.paused) svg.unpauseAnimations()
      }
      timelines.clear()
    },
  }
}

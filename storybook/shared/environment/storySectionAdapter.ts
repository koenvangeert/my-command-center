import { get } from 'svelte/store'
import { clearCollapsedSections, collapsedSections, setSectionCollapsed } from '../../../packages/plugin-sdk/src/collapsibleSectionState'
import type { StoryEnvironmentAdapter } from './storyEnvironment'

/** The SDK section store survives component unmounts as well as storage resets. */
export function createStorySectionAdapter(initial: readonly string[] = []): StoryEnvironmentAdapter {
  let original: string[] | undefined
  function apply(keys: readonly string[]) {
    clearCollapsedSections()
    for (const key of keys) setSectionCollapsed(key, true)
  }
  return {
    install() {
      if (original) return
      original = Object.keys(get(collapsedSections))
      apply(initial)
    },
    reset() {
      if (!original) throw new Error('Section adapter must be installed before reset')
      apply(initial)
    },
    dispose() {
      if (!original) return
      apply(original)
      original = undefined
    },
  }
}

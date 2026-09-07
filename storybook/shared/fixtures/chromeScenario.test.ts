import { describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import * as stores from '../../../src/lib/stores'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { chromeScenario } from './chromeScenario'

describe('host chrome scenario lifecycle', () => {
  it('replays selection, hidden projects and feedback without retaining previous interactions', async () => {
    const originalProjects = get(stores.projects)
    const originalError = get(stores.error)
    const scenario = chromeScenario('error')
    const environment = createStoryEnvironment({ id: 'chrome', now: '2026-01-02T09:30:00Z', adapters: scenario.adapters?.() })
    await environment.install()
    try {
      expect(get(stores.projects).map(project => project.name)).toEqual(['OpenForge', 'Documentation and contributor onboarding', 'Archived experiments'])
      expect(get(stores.activeProjectId)).toBe('P-1')
      expect(get(stores.error)).toBe('Could not save project settings. Your changes have not been saved.')
      stores.error.set(null)
      stores.activeProjectId.set('P-2')
      stores.hiddenProjectIds.set(new Set())
      stores.commandHeld.set(true)
      stores.taskSpawned.set({ taskId: 'T-old', promptText: 'Stale notification' })
      await environment.reset()
      expect(get(stores.activeProjectId)).toBe('P-1')
      expect(get(stores.hiddenProjectIds)).toEqual(new Set(['P-3']))
      expect(get(stores.commandHeld)).toBe(false)
      expect(get(stores.taskSpawned)).toBeNull()
      expect(get(stores.error)).toBe('Could not save project settings. Your changes have not been saved.')
    } finally {
      await environment.dispose()
    }
    expect(get(stores.projects)).toBe(originalProjects)
    expect(get(stores.error)).toBe(originalError)
  })
})

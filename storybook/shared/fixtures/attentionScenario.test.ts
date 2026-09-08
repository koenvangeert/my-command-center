import { afterEach, describe, expect, it } from 'vitest'
import { getConfig, getTaskLanes, setConfig } from '../../../src/lib/ipc'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { attentionScenario } from './attentionScenario'

const disposals: Array<() => void> = []
afterEach(() => { for (const dispose of disposals.splice(0)) dispose() })

function install(kind: Parameters<typeof attentionScenario>[0]) {
  const adapter = createStoryDesktopAdapter(attentionScenario(kind).desktop)
  adapter.install()
  disposals.push(() => adapter.dispose())
  return adapter
}

describe('attention story desktop boundary', () => {
  it('provides independent lane data and restores persisted dialog preferences', async () => {
    const adapter = install('populated')
    const lanes = await getTaskLanes()
    expect(lanes.focus.map(row => row.state)).toEqual(['needs-input', 'failed', 'agent-done'])
    expect(lanes.in_flight.map(row => row.state)).toEqual(['active', 'ci-running'])
    expect(lanes.focus[0].has_unread_agent_output).toBe(true)
    lanes.focus.length = 0
    expect((await getTaskLanes()).focus).toHaveLength(3)
    await setConfig('attention_overview_collapsed_projects', '["project-1"]')
    adapter.reset()
    expect(await getConfig('attention_overview_collapsed_projects')).toBeNull()
    expect((await getTaskLanes()).focus).toHaveLength(3)
  })
})

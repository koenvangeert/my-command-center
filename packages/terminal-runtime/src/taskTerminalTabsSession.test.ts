import { describe, expect, it } from 'vitest'
import { createTaskTerminalTabsSessionStore } from './taskTerminalTabsSession'

describe('task terminal tabs session store', () => {
  it('merges fresh inventory on retries without resetting user tab edits', () => {
    const store = createTaskTerminalTabsSessionStore()
    const saved = [{ taskId: 'T-1', tabs: [{ index: 0, key: 'T-1-shell-0', label: 'Original' }], activeTabIndex: 0, nextIndex: 1 }]
    store.restore('op', saved, ['T-1-shell-0'])
    store.get('T-1').tabs[0].label = 'Renamed'
    store.restore('op', saved, ['T-1-shell-0', 'T-1-shell-1'])
    expect(store.get('T-1')).toEqual({ tabs: [{ index: 0, key: 'T-1-shell-0', label: 'Renamed' }, { index: 1, key: 'T-1-shell-1', label: 'Shell 2' }], activeTabIndex: 0, nextIndex: 2 })
  })
  it('creates and retains the default shell session for each Task', () => {
    const store = createTaskTerminalTabsSessionStore()

    const first = store.get('T-1')

    expect(first).toEqual({
      tabs: [{ index: 0, key: 'T-1-shell-0', label: 'Shell 1' }],
      activeTabIndex: 0,
      nextIndex: 1,
    })
    expect(store.get('T-1')).toBe(first)
    expect(store.get('T-2')).not.toBe(first)
  })

  it('updates and clears Task-owned session state', () => {
    const store = createTaskTerminalTabsSessionStore()
    const updated = {
      tabs: [{ index: 3, key: 'T-1-shell-3', label: 'Shell 4' }],
      activeTabIndex: 3,
      nextIndex: 4,
    }

    store.update('T-1', updated)
    expect(store.get('T-1')).toBe(updated)

    store.clear('T-1')
    expect(store.get('T-1')).not.toBe(updated)
  })

  it('captures every known Task without aliasing mutable tab state or saving runtime data', () => {
    const store = createTaskTerminalTabsSessionStore()
    store.update('T-1', {
      tabs: [{ index: 3, key: 'T-1-shell-3', label: 'Server', output: 'secret' }],
      activeTabIndex: 3, nextIndex: 8, credentials: 'secret',
    } as never)
    store.get('T-2')
    const snapshot = store.snapshot()
    store.get('T-1').tabs[0].label = 'Changed'
    expect(snapshot).toEqual([
      { taskId: 'T-1', tabs: [{ index: 3, key: 'T-1-shell-3', label: 'Server' }], activeTabIndex: 3, nextIndex: 8 },
      { taskId: 'T-2', tabs: [{ index: 0, key: 'T-2-shell-0', label: 'Shell 1' }], activeTabIndex: 0, nextIndex: 1 },
    ])
  })

  it('reconciles all saved Tasks and unsnapshotted indexed shells before allocating new tabs', () => {
    const store = createTaskTerminalTabsSessionStore()
    const saved = [
      { taskId: 'T-1', tabs: [
        { index: 4, key: 'T-1-shell-4', label: 'Server' },
        { index: 1, key: 'T-1-shell-1', label: 'Exited' },
      ], activeTabIndex: 1, nextIndex: 6 },
      { taskId: 'T-2', tabs: [{ index: 2, key: 'T-2-shell-2', label: 'Other task' }], activeTabIndex: 2, nextIndex: 3 },
    ]
    store.restore('operation-1', saved, ['T-1-shell-9', 'T-1-shell-4', 'T-3-shell-2', 'T-3', 'T-1-shell-9'])
    expect(store.get('T-1')).toEqual({
      tabs: [...saved[0].tabs, { index: 9, key: 'T-1-shell-9', label: 'Shell 10' }],
      activeTabIndex: 1, nextIndex: 10,
    })
    expect(store.get('T-2').tabs[0].label).toBe('Other task')
    expect(store.get('T-3')).toEqual({
      tabs: [{ index: 2, key: 'T-3-shell-2', label: 'Shell 3' }], activeTabIndex: 2, nextIndex: 3,
    })
    store.get('T-1').tabs[0].label = 'New name'
    store.get('T-1').activeTabIndex = 9
    store.restore('operation-1', saved, ['T-1-shell-9', 'T-1-shell-4'])
    expect(store.get('T-1').tabs).toHaveLength(3)
    expect(store.get('T-1').tabs[0].label).toBe('New name')
    expect(store.get('T-1').activeTabIndex).toBe(9)
    expect(saved[0].tabs[0].label).toBe('Server')
  })
})

import { createIndexedShellSessionKey, parsePtySessionKey } from './ptySessionKey'
import type { TaskTerminalTabsSession } from './terminalRuntimeTypes'

function createDefaultTaskTerminalTabsSession(taskId: string): TaskTerminalTabsSession {
  return {
    tabs: [{
      index: 0,
      key: createIndexedShellSessionKey({ taskId, terminalIndex: 0 }),
      label: 'Shell 1',
    }],
    activeTabIndex: 0,
    nextIndex: 1,
  }
}

export function createTaskTerminalTabsSessionStore() {
  const sessions = new Map<string, TaskTerminalTabsSession>()

  function get(taskId: string): TaskTerminalTabsSession {
    const existing = sessions.get(taskId)
    if (existing) return existing

    const session = createDefaultTaskTerminalTabsSession(taskId)
    sessions.set(taskId, session)
    return session
  }

  function update(taskId: string, session: TaskTerminalTabsSession): void {
    sessions.set(taskId, session)
  }

  function clear(taskId: string): void {
    sessions.delete(taskId)
  }

  function clearAll(): void {
    sessions.clear()
  }

  function snapshot(): Array<TaskTerminalTabsSession & { taskId: string }> {
    return [...sessions].map(([taskId, session]) => ({
      taskId,
      tabs: session.tabs.map(({ index, key, label }) => ({ index, key, label })),
      activeTabIndex: session.activeTabIndex,
      nextIndex: session.nextIndex,
    }))
  }

  let restoredOperation: string | null = null

  function restore(
    operationId: string,
    saved: Array<TaskTerminalTabsSession & { taskId: string }>,
    inventoryKeys: readonly string[],
  ): boolean {
    const firstApplication = restoredOperation !== operationId
    const reconciled = new Map<string, TaskTerminalTabsSession>()
    let changed = firstApplication
    for (const { taskId, tabs, activeTabIndex, nextIndex } of firstApplication ? saved : snapshot()) {
      reconciled.set(taskId, {
        tabs: tabs.map(({ index, key, label }) => ({ index, key, label })),
        activeTabIndex, nextIndex,
      })
    }
    for (const key of inventoryKeys) {
      const parsed = parsePtySessionKey(key)
      if (parsed.kind !== 'indexed-shell') continue
      const { taskId, terminalIndex: index } = parsed
      const session = reconciled.get(taskId) ?? { tabs: [], activeTabIndex: index, nextIndex: 0 }
      if (!session.tabs.some(tab => tab.index === index)) {
        session.tabs.push({ index, key, label: `Shell ${index + 1}` })
        changed = true
      }
      reconciled.set(taskId, session)
    }
    for (const [taskId, session] of reconciled) {
      session.nextIndex = Math.max(session.nextIndex, ...session.tabs.map(tab => tab.index + 1))
      sessions.set(taskId, session)
    }
    restoredOperation = operationId
    return changed
  }

  return { get, update, clear, clearAll, snapshot, restore }
}

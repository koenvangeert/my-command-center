export interface TerminalTab {
  index: number
  key: string
  label: string
}

export interface TerminalTabsSession {
  tabs: TerminalTab[]
  activeTabIndex: number
  nextIndex: number
}

const sessions = new Map<string, TerminalTabsSession>()

function createDefaultSession(taskId: string): TerminalTabsSession {
  return {
    tabs: [{ index: 0, key: `${taskId}-shell-0`, label: 'Shell 1' }],
    activeTabIndex: 0,
    nextIndex: 1,
  }
}

export function createTerminalTabsSession(taskId: string): TerminalTabsSession {
  const existing = sessions.get(taskId)
  if (existing) return existing

  const session = createDefaultSession(taskId)
  sessions.set(taskId, session)
  return session
}

export function getTerminalTabsSession(taskId: string): TerminalTabsSession | undefined {
  return sessions.get(taskId)
}

export function clearTerminalTabsSession(taskId: string): void {
  sessions.delete(taskId)
}

export function clearAllTerminalTabsSessions(): void {
  sessions.clear()
}

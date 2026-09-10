import type { RestartTaskTabs, RestartWindowWorkspace, RestartWorkspace } from './restartWorkspace.js'

function invalid(): never { throw new Error('Invalid or incompatible restart workspace') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > 1024 || (!allowEmpty && !value.trim())) return invalid()
  return value
}
function nullableId(value: unknown): string | null { return value === null ? null : text(value) }
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalid()
  return value
}
function list<T>(value: unknown, max: number, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid()
  return value.map(parse)
}
function unique(values: (string | number)[]): void {
  if (new Set(values).size !== values.length) invalid()
}

export function parseRestartTaskTabs(value: unknown): RestartTaskTabs {
  const task = object(value)
  const taskId = text(task.taskId)
  const tabs = list(task.tabs, 4096, value => {
    const tab = object(value)
    const index = integer(tab.index, 0, 0xffff_ffff)
    const key = text(tab.key)
    if (key !== `${taskId}-shell-${index}`) return invalid()
    return { index, key, label: text(tab.label, true) }
  })
  unique(tabs.map(tab => tab.index))
  const activeTabIndex = integer(task.activeTabIndex, -1, 0xffff_ffff)
  const nextIndex = integer(task.nextIndex, 0, 0x1_0000_0000)
  if (tabs.length ? !tabs.some(tab => tab.index === activeTabIndex) : activeTabIndex !== -1) invalid()
  if (tabs.some(tab => tab.index >= nextIndex)) invalid()
  return { taskId, tabs, activeTabIndex, nextIndex }
}

export function parseRestartWindowWorkspace(value: unknown): RestartWindowWorkspace {
  const window = object(value)
  const location = object(window.navigation)
  const tasks = list(window.tasks, 4096, parseRestartTaskTabs)
  unique(tasks.map(task => task.taskId))
  return {
    windowId: text(window.windowId),
    navigation: {
      projectId: nullableId(location.projectId), taskId: nullableId(location.taskId), view: text(location.view),
      ...(location.taskView === undefined ? {} : { taskView: nullableId(location.taskView) }),
    },
    tasks,
  }
}

export function parseRestartWorkspace(value: unknown): RestartWorkspace {
  const record = object(value)
  if (record.version !== 1) return invalid()
  const windows = list(record.windows, 32, parseRestartWindowWorkspace)
  if (!windows.length) invalid()
  unique(windows.map(window => window.windowId))
  const restoredWindowIds = list(record.restoredWindowIds, 32, value => text(value))
  unique(restoredWindowIds)
  if (restoredWindowIds.some(id => !windows.some(window => window.windowId === id))) invalid()
  return { version: 1, installationId: text(record.installationId), operationId: text(record.operationId), windows, restoredWindowIds }
}

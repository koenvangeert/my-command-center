import type { RestartTaskTabs, RestartTerminalInventory, RestartWindowWorkspace } from '../electron/restartWorkspace'

interface RestartWorkspacePort {
  load(): Promise<{ operationId: string; window: RestartWindowWorkspace } | null>
  inventory(): Promise<RestartTerminalInventory>
  reconcileController(inventory: RestartTerminalInventory): void
  restoreTabs(operationId: string, tasks: RestartTaskTabs[], inventoryKeys: readonly string[]): void
  restoreNavigation(source: Promise<RestartWindowWorkspace['navigation'] | null>, hydrated: Promise<void>, scope: object): Promise<void>
  complete(operationId: string): Promise<void>
}

/** Keep Task views unmounted until start resolves. Failures leave the record available for retry. */
export function createRestartWorkspaceController(port: RestartWorkspacePort) {
  let started: Promise<void> | null = null
  let disposed = false
  const navigationScope = {}

  function start(hydrated: Promise<void>): Promise<void> {
    if (started) return started
    const workspace = Promise.all([port.load(), hydrated]).then(async ([saved]) => {
      if (!saved || disposed) return null
      const inventory = await port.inventory()
      if (disposed) return null
      port.reconcileController(inventory)
      port.restoreTabs(saved.operationId, saved.window.tasks, inventory.sessions.map(session => session.key))
      return saved
    })
    const navigation = port.restoreNavigation(workspace.then(saved => saved?.window.navigation ?? null), hydrated, navigationScope)
    started = Promise.all([workspace, navigation]).then(async ([saved]) => {
      if (saved && !disposed) await port.complete(saved.operationId)
    }).catch(error => {
      started = null
      throw error
    })
    return started
  }

  return { start, dispose: () => { disposed = true } }
}

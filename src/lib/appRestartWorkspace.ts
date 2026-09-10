import { get } from 'svelte/store'
import { isElectronDesktopBridgeAvailable, listenDesktopEvent } from './desktopIpc'
import { captureRestartWorkspace, completeRestartWorkspace, getRestartTerminalInventory, getRestartWorkspace } from './ipc'
import { createRestartWorkspaceController } from './restartWorkspaceController'
import { reconcileRestartTerminalInventory, terminalSessionService } from './terminalSessionService'
import { activeProjectId, currentView, selectedTaskId, taskActiveView } from './stores'
import type { createAppNavigationController } from './appNavigationController'

export function createAppRestartWorkspace(navigation: ReturnType<typeof createAppNavigationController>) {
  let disposed = false
  let unlisten: (() => void) | null = null
  const controller = createRestartWorkspaceController({
    load: getRestartWorkspace,
    inventory: getRestartTerminalInventory,
    reconcileController: reconcileRestartTerminalInventory,
    restoreTabs: terminalSessionService.restoreWorkspace,
    restoreNavigation: navigation.restoreWorkspaceNavigation,
    complete: completeRestartWorkspace,
  })
  let listening: Promise<void> | null = null

  function start(hydrated: Promise<void>): Promise<void> {
    if (!isElectronDesktopBridgeAvailable()) return hydrated
    listening ??= listenDesktopEvent('restart-workspace-capture', async ({ payload }) => {
      if (disposed) return
      try {
        await captureRestartWorkspace(payload.operationId, {
          navigation: {
            projectId: get(activeProjectId), taskId: get(selectedTaskId), view: get(currentView),
            taskView: get(taskActiveView).get(get(selectedTaskId) ?? '') ?? null,
          },
          tasks: terminalSessionService.snapshotWorkspace(),
        })
      } catch (error) {
        console.error('[restart] Required workspace capture failed; restart will be cancelled:', error)
      }
    }).then(stop => {
      if (disposed) stop()
      else unlisten = stop
    })
    return controller.start(Promise.all([hydrated, listening]).then(() => undefined))
  }

  return {
    start,
    dispose() {
      disposed = true
      unlisten?.()
      controller.dispose()
    },
  }
}

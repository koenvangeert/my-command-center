import type { RestartWindowWorkspace } from './restartWorkspace.js'
import type { RestartWorkspaceStore } from './restartWorkspaceStore.js'

type Capture = () => Promise<Omit<RestartWindowWorkspace, 'windowId'>>

/** Internal controlled-restart boundary. This does not expose the public Restart action. */
export class RestartWorkspaceCoordinator {
  private readonly windows = new Map<string, Capture>()
  private restarting = false

  constructor(private readonly store: RestartWorkspaceStore) {}

  register(windowId: string, capture: Capture): () => void {
    if (this.windows.has(windowId)) throw new Error('Restart window identity is already registered')
    this.windows.set(windowId, capture)
    return () => { if (this.windows.get(windowId) === capture) this.windows.delete(windowId) }
  }

  async restart(operationId: string, replace: (assertCurrent: () => void) => Promise<void>): Promise<void> {
    if (this.restarting) throw new Error('A controlled restart is already preparing')
    this.restarting = true
    try {
      const participants = [...this.windows]
      if (!participants.length) throw new Error('Cannot restart without a captured workspace')
      const windows = await Promise.all(participants.map(async ([windowId, capture]) => ({ ...await capture(), windowId })))
      const assertCurrent = () => {
        if (participants.length !== this.windows.size || participants.some(([id, capture]) => this.windows.get(id) !== capture)) {
          throw new Error('Restart windows changed during workspace capture; retry the restart')
        }
      }
      assertCurrent()
      await this.store.capture(operationId, windows)
      assertCurrent()
      await replace(assertCurrent)
    } finally {
      this.restarting = false
    }
  }
}

import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { RestartWorkspaceIpc } from './restartWorkspaceIpc.js'
import { RestartWorkspaceStore } from './restartWorkspaceStore.js'
import type { RestartTerminalInventory } from './restartWorkspace.js'

export async function createControlledRestartHost(options: {
  root: string
  operationId: string | null
  inventory(): Promise<RestartTerminalInventory>
  replace(operationId: string): Promise<void>
}): Promise<RestartWorkspaceIpc> {
  const initial = await options.inventory()
  const daemonInstallation = initial.controller.installation
  const installationId = createHash('sha256').update(JSON.stringify([options.root, daemonInstallation])).digest('hex')
  return new RestartWorkspaceIpc(
    new RestartWorkspaceStore(join(options.root, 'restart-workspace.json'), installationId),
    options.operationId,
    async (operationId, assertCurrent) => {
      const current = await options.inventory()
      if (current.controller.installation !== daemonInstallation) throw new Error('Daemon installation changed during capture')
      if (current.hasLegacySessions !== false) throw new Error('Controlled restart cannot preserve legacy processes')
      assertCurrent()
      await options.replace(operationId)
    },
  )
}

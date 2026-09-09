import { createRestartTerminalControl } from './restartTerminalControl'
import { getPtyBuffer, getRestartTerminalInventory, killPty, resizePty, writePty } from './ipc'

// One ephemeral controller identity serves the host transport and explicit shell actions.
export const desktopRestartTerminalControl = createRestartTerminalControl({
  getPtyBuffer: (...args) => getPtyBuffer(...args),
  inventory: () => getRestartTerminalInventory(),
  writePty: (...args) => writePty(...args),
  resizePty: (...args) => resizePty(...args),
  killPty: (...args) => killPty(...args),
})

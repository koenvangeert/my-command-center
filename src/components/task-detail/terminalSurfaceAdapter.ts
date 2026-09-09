import type { TerminalSurfaceAdapter } from '@openforge-app/terminal-runtime'
import { getTaskWorkspace, spawnShellPty } from '../../lib/ipc'
import { desktopRestartTerminalControl } from '../../lib/desktopRestartTerminalControl'
import { regularTerminalSessions } from '../../lib/terminalSessionService'
import {
  registerTerminalTaskPaneController,
  unregisterTerminalTaskPaneController,
} from './terminalTaskPaneController'

export const desktopTerminalSurfaceAdapter: TerminalSurfaceAdapter = {
  runtime: regularTerminalSessions,
  spawnShellPty,
  killPty: desktopRestartTerminalControl.killPty,
  getTaskWorkspace,
  getWorkspacePath: workspace => workspace?.workspace_path ?? null,
  registerTaskPaneController: registerTerminalTaskPaneController,
  unregisterTaskPaneController: unregisterTerminalTaskPaneController,
}

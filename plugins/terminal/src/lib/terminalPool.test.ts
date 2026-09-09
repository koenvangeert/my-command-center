import { expect, it, vi } from 'vitest'
import { createTerminalRuntime, createTerminalSessionService } from '@openforge-app/terminal-runtime'
import * as pool from './terminalPool'

it('preserves the host no-auto-start decision for restored shells', () => {
  const runtime = createTerminalRuntime({
    environment: { openLink: vi.fn() },
    transport: {
      subscribeSession: vi.fn(), subscribeConnectionRestored: vi.fn(),
      readReplay: vi.fn(), writeUserInput: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
    },
  })
  runtime.restoreWorkspace('operation', [{ taskId: 'T-1', tabs: [{ index: 7, key: 'T-1-shell-7', label: 'Exited' }], activeTabIndex: 7, nextIndex: 8 }], [])
  pool.configureTerminalSessionClient(createTerminalSessionService(runtime).createClient('terminal-plugin'))
  expect(pool.canAutoStartShell('T-1-shell-7')).toBe(false)
  expect(pool.canAutoStartShell('T-2-shell-0')).toBe(true)
  runtime.dispose()
})

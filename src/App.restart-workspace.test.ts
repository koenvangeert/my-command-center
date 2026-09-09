import { render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import { installAppTestLifecycle } from './App.test-harness'

describe('controlled workspace startup', () => {
  installAppTestLifecycle()

  it('does not mount Task views or consume the record while daemon inventory is unavailable', async () => {
    const App = (await import('./App.svelte')).default
    const ipc = await import('./lib/ipc')
    const { terminalSessionService } = await import('./lib/terminalSessionService')
    const tasks = [{ taskId: 'T-other', tabs: [{ index: 4, key: 'T-other-shell-4', label: 'Server' }], activeTabIndex: 4, nextIndex: 7 }]
    vi.mocked(ipc.getRestartWorkspace).mockResolvedValue({ operationId: 'operation-1', window: { windowId: 'stable-a', navigation: { projectId: 'proj-1', taskId: null, view: 'board' }, tasks } })
    let reconcile!: () => void
    vi.mocked(ipc.getRestartTerminalInventory).mockImplementation(() => new Promise(resolve => {
      reconcile = () => resolve({ controller: { installation: 'installation', lifetime: 'daemon', generation: 2 }, sessions: [{ key: 'T-other-shell-4', instanceId: 7, isLive: true }] })
    }))
    const { container } = render(App)
    await vi.waitFor(() => expect(reconcile).toBeDefined())
    expect(screen.getByRole('status').textContent).toContain('Loading workspace')
    expect(container.querySelector('[data-app-ready="true"]')).toBeNull()
    expect(ipc.completeRestartWorkspace).not.toHaveBeenCalled()
    reconcile()
    await waitFor(() => expect(container.querySelector('[data-app-ready="true"]')).not.toBeNull())
    expect(terminalSessionService.restoreWorkspace).toHaveBeenCalledWith('operation-1', tasks, ['T-other-shell-4'])
    expect(ipc.completeRestartWorkspace).toHaveBeenCalledWith('operation-1')
  })
})

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { RestartWorkspaceIpc } from './restartWorkspaceIpc'
import { RestartWorkspaceStore } from './restartWorkspaceStore'

it('binds capture and restoration to host-assigned windows, not renderer-supplied identities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-workspace-ipc-'))
  try {
    const store = new RestartWorkspaceStore(join(root, 'workspace.json'), 'installation')
    const replace = vi.fn(async () => undefined)
    const host = new RestartWorkspaceIpc(store, null, replace)
    const send = vi.fn()
    host.register(12, 'stable-a', send)
    const restart = host.handle(12, 'controlled_restart', {})
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const operationId = send.mock.calls[0][0]
    const snapshot = { navigation: { projectId: 'P-1', taskId: null, view: 'board' }, tasks: [] }
    await expect(host.handle(99, 'capture_restart_workspace', { operationId, snapshot })).rejects.toThrow()
    await host.handle(12, 'capture_restart_workspace', { operationId, snapshot })
    await restart
    expect(replace).toHaveBeenCalledWith(operationId, expect.any(Function))
    const replacement = new RestartWorkspaceIpc(store, operationId, replace)
    replacement.register(30, 'stable-a', vi.fn())
    expect(await replacement.handle(30, 'get_restart_workspace', {})).toEqual({ operationId, window: { windowId: 'stable-a', ...snapshot } })
    await replacement.handle(30, 'complete_restart_workspace', { operationId })
    expect(await replacement.handle(30, 'get_restart_workspace', {})).toBeNull()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('creates independent controlled windows and retries only unconsumed window records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-workspace-windows-'))
  try {
    const store = new RestartWorkspaceStore(join(root, 'workspace.json'), 'installation')
    const host = new RestartWorkspaceIpc(store, 'operation', async () => undefined)
    expect(new Set(await host.launchWindowIds(2)).size).toBe(2)
    const navigation = { projectId: 'P-1', taskId: null, view: 'board' }
    await store.capture('operation', ['stable-a', 'stable-b'].map(windowId => ({ windowId, navigation, tasks: [] })))
    expect(await host.launchWindowIds()).toEqual(['stable-a', 'stable-b'])
    host.register(10, 'stable-a', vi.fn())
    await host.handle(10, 'complete_restart_workspace', { operationId: 'operation' })
    expect(await host.launchWindowIds()).toEqual(['stable-b'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

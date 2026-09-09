import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createControlledRestartHost } from './controlledRestartHost'

it('aborts replacement when a legacy process appeared during workspace capture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-controlled-restart-'))
  try {
    const controller = { installation: 'daemon-installation', lifetime: 'daemon', generation: 1 }
    const inventory = vi.fn().mockResolvedValueOnce({ controller, sessions: [], hasLegacySessions: false }).mockResolvedValue({ controller, sessions: [], hasLegacySessions: true })
    const replace = vi.fn(async () => undefined)
    const host = await createControlledRestartHost({ root, operationId: null, inventory, replace })
    const send = vi.fn()
    host.register(10, 'stable', send)
    const rejected = expect(host.handle(10, 'controlled_restart', {})).rejects.toThrow('legacy')
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    await host.handle(10, 'capture_restart_workspace', { operationId: send.mock.calls[0][0], snapshot: { navigation: { projectId: null, taskId: null, view: 'board' }, tasks: [] } })
    await rejected
    expect(replace).not.toHaveBeenCalled()
  } finally { await rm(root, { recursive: true, force: true }) }
})

it('does not restore a workspace against a different daemon installation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-controlled-restart-'))
  try {
    const controller = { installation: 'daemon-installation', lifetime: 'daemon', generation: 1 }
    const inventory = vi.fn(async () => ({ controller, sessions: [], hasLegacySessions: false }))
    const replace = vi.fn(async () => undefined)
    const host = await createControlledRestartHost({ root, operationId: null, inventory, replace })
    const send = vi.fn()
    host.register(10, 'stable', send)
    const restart = host.handle(10, 'controlled_restart', {})
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const operationId = send.mock.calls[0][0]
    await host.handle(10, 'capture_restart_workspace', { operationId, snapshot: { navigation: { projectId: null, taskId: null, view: 'board' }, tasks: [] } })
    await restart
    const other = await createControlledRestartHost({ root, operationId, replace, inventory: async () => ({ controller: { ...controller, installation: 'other-daemon' }, sessions: [], hasLegacySessions: false }) })
    expect(await other.launchWindowIds()).not.toContain('stable')
  } finally { await rm(root, { recursive: true, force: true }) }
})

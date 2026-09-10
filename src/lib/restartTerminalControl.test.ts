import { expect, it, vi } from 'vitest'
import { createRestartTerminalControl } from './restartTerminalControl'

it('fences replay and disables input until the current controller and PTY have reconciled', async () => {
  let finish!: (value: unknown) => void
  const firstRead = new Promise(resolve => { finish = resolve })
  const replay = { buffer: null, snapshot: null, instanceId: 7, isLive: true }
  const port = {
    getPtyBuffer: vi.fn().mockReturnValueOnce(firstRead).mockResolvedValue(replay),
    writePty: vi.fn(async () => undefined), resizePty: vi.fn(async () => undefined),
    inventory: vi.fn(),
    killPty: vi.fn(async () => undefined),
  }
  const control = createRestartTerminalControl(port)
  const controller = { installation: 'installation', lifetime: 'daemon', generation: 1 }
  control.reconcile({ controller, sessions: [{ key: 'T-1-shell-0', instanceId: 7, isLive: true }] })
  port.inventory.mockResolvedValue({ controller, sessions: [{ key: 'T-1-shell-0', instanceId: 7, isLive: true }] })
  await expect(control.writePty('T-1-shell-0', 'input')).rejects.toThrow(/reconcil/i)
  const reading = control.getPtyBuffer('T-1-shell-0')
  await vi.waitFor(() => expect(port.getPtyBuffer).toHaveBeenCalledOnce())
  control.reconcile({ controller: { ...controller, generation: 2 }, sessions: [{ key: 'T-1-shell-0', instanceId: 7, isLive: true }] })
  port.inventory.mockResolvedValue({ controller: { ...controller, generation: 2 }, sessions: [{ key: 'T-1-shell-0', instanceId: 7, isLive: true }] })
  finish(replay)
  await expect(reading).rejects.toThrow(/stale/i)
  expect(port.writePty).not.toHaveBeenCalled()
  await control.getPtyBuffer('T-1-shell-0')
  await control.writePty('T-1-shell-0', 'input')
  expect(port.writePty).toHaveBeenCalledWith('T-1-shell-0', 'input', { controller: { ...controller, generation: 2 }, instanceId: 7 })
  await control.killPty('T-1-shell-0')
  expect(port.killPty).toHaveBeenCalledWith('T-1-shell-0', { controller: { ...controller, generation: 2 }, instanceId: 7 })
  control.suspend()
  await expect(control.resizePty('T-1-shell-0', 80, 24)).rejects.toThrow(/reconcil/i)
})

it('keeps missing saved shells inactive and discovers newly spawned indexes without gating legacy agent terminals', async () => {
  const controller = { installation: 'installation', lifetime: 'daemon', generation: 1 }
  const replay = { buffer: null, snapshot: null, instanceId: 8, isLive: true }
  const port = {
    getPtyBuffer: vi.fn(async () => replay),
    writePty: vi.fn(async () => undefined), resizePty: vi.fn(async () => undefined),
    killPty: vi.fn(async () => undefined),
    inventory: vi.fn().mockResolvedValueOnce({ controller, sessions: [] }).mockResolvedValue({ controller, sessions: [{ key: 'T-1-shell-9', instanceId: 8, isLive: true }] }),
  }
  const control = createRestartTerminalControl(port)
  control.reconcile({ controller, sessions: [] })
  await expect(control.getPtyBuffer('T-1-shell-9')).resolves.toEqual({ buffer: null, snapshot: null, instanceId: null, isLive: false })
  expect(port.getPtyBuffer).not.toHaveBeenCalled()
  await expect(control.getPtyBuffer('T-1-shell-9')).resolves.toEqual(replay)
  await control.writePty('T-1-shell-9', 'new shell')
  expect(port.writePty).toHaveBeenCalledWith('T-1-shell-9', 'new shell', { controller, instanceId: 8 })
  await control.getPtyBuffer('T-agent')
  expect(port.getPtyBuffer).toHaveBeenLastCalledWith('T-agent')
})

it('reconciles an explicitly replaced PTY at the same tab key without reusing its old fence', async () => {
  const controller = { installation: 'installation', lifetime: 'daemon', generation: 1 }
  const port = {
    inventory: vi.fn(async () => ({ controller, sessions: [{ key: 'T-1-shell-0', instanceId: 9, isLive: true }] })),
    getPtyBuffer: vi.fn(async () => ({ buffer: null, snapshot: null, instanceId: 9, isLive: true })),
    writePty: vi.fn(async () => undefined), resizePty: vi.fn(async () => undefined),
    killPty: vi.fn(async () => undefined),
  }
  const control = createRestartTerminalControl(port)
  control.reconcile({ controller, sessions: [{ key: 'T-1-shell-0', instanceId: 7, isLive: false }] })
  await control.getPtyBuffer('T-1-shell-0')
  await control.writePty('T-1-shell-0', 'new instance')
  expect(port.writePty).toHaveBeenCalledWith('T-1-shell-0', 'new instance', { controller, instanceId: 9 })
})

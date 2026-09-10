import { describe, expect, it, vi } from 'vitest'
import { createHost } from './terminalRuntimeHost.testSupport'
import { createFakeTerminalView } from './terminalView.testUtils'
import { createTerminalRuntime } from './terminalRuntime'
import { createTerminalSessionService } from './terminalSessionService'

describe('host-owned terminal session service', () => {
  it('restores all Tasks through the host without acquiring shells or granting workspace mutation to clients', () => {
    const host = createHost()
    const runtime = createTerminalRuntime({ ...host, createTerminalView: () => createFakeTerminalView() })
    const service = createTerminalSessionService(runtime)
    const client = service.createClient('terminal-plugin')
    const tasks = [{ taskId: 'T-1', tabs: [{ index: 4, key: 'T-1-shell-4', label: 'Saved' }], activeTabIndex: 4, nextIndex: 5 }]
    service.restoreWorkspace('operation-1', tasks, ['T-1-shell-9'])
    expect(service.snapshotWorkspace()[0].nextIndex).toBe(10)
    expect(client.getTaskTerminalTabsSession('T-1').tabs.map(tab => tab.key)).toEqual(['T-1-shell-4', 'T-1-shell-9'])
    expect(client.canAutoStartShell('T-1-shell-4')).toBe(false)
    expect(client.canAutoStartShell('T-1-shell-9')).toBe(false)
    expect(client.canAutoStartShell('T-1-shell-10')).toBe(true)
    client.getTaskTerminalTabsSession('T-2')
    service.restoreWorkspace('operation-1', tasks, ['T-1-shell-9'])
    expect(client.canAutoStartShell('T-2-shell-0')).toBe(true)
    expect(runtime.diagnostics.list()).toEqual([])
    expect(client).not.toHaveProperty('restoreWorkspace')
    expect(client).not.toHaveProperty('snapshotWorkspace')
    service.dispose()
  })
  it('shares one Terminal Session across concurrent clients and disposes it after the last owner releases it', async () => {
    const view = createFakeTerminalView()
    const runtime = createTerminalRuntime({ ...createHost(), createTerminalView: () => view })
    const service = createTerminalSessionService(runtime)
    const agent = service.createClient('agent')
    const regularTerminal = service.createClient('terminal-plugin')

    const [agentEntry, regularEntry] = await Promise.all([
      agent.acquire('T-1-shell-0'),
      regularTerminal.acquire('T-1-shell-0'),
    ])

    expect(regularEntry).toBe(agentEntry)
    expect(runtime.diagnostics.list()).toHaveLength(1)

    agent.release('T-1-shell-0')
    expect(runtime.diagnostics.list()).toHaveLength(1)
    expect(view.dispose).not.toHaveBeenCalled()

    regularTerminal.release('T-1-shell-0')
    expect(runtime.diagnostics.list()).toHaveLength(0)
    expect(view.dispose).toHaveBeenCalledOnce()
  })

  it('limits bulk release to the calling client', async () => {
    const views = [createFakeTerminalView(), createFakeTerminalView()]
    const runtime = createTerminalRuntime({ ...createHost(), createTerminalView: vi.fn(() => views.shift() ?? createFakeTerminalView()), })
    const service = createTerminalSessionService(runtime)
    const agent = service.createClient('agent')
    const regularTerminal = service.createClient('terminal-plugin')

    await agent.acquire('T-1')
    await regularTerminal.acquire('T-1-shell-0')

    agent.releaseAll()

    expect(runtime.hasTerminal('T-1')).toBe(false)
    expect(runtime.hasTerminal('T-1-shell-0')).toBe(true)
  })

  it('can hold acquisition at session creation and is inert without a hook', async () => {
    let releaseCheckpoint!: () => void
    let checkpointSession: object | null = null
    const beforeSessionStart = vi.fn((session, getDiagnostics) => {
      checkpointSession = session
      expect(getDiagnostics().shellSessionKey).toBe('T-gated-shell-0')
      return new Promise<void>(resolve => { releaseCheckpoint = resolve })
    })
    const runtime = createTerminalRuntime({
      ...createHost(),
      createTerminalView: () => createFakeTerminalView(),
      beforeSessionStart,
    })
    const service = createTerminalSessionService(runtime)
    const client = service.createClient('agent')

    let returned = false
    const acquisition = client.acquire('T-gated-shell-0').then((session) => {
      returned = true
      return session
    })
    await vi.waitFor(() => expect(beforeSessionStart).toHaveBeenCalledOnce())

    expect(returned).toBe(false)

    releaseCheckpoint()
    await expect(acquisition).resolves.toBe(checkpointSession)

    const ungatedRuntime = createTerminalRuntime({
      ...createHost(),
      createTerminalView: () => createFakeTerminalView(),
    })
    const ungatedService = createTerminalSessionService(ungatedRuntime)
    await expect(ungatedService.createClient('terminal-plugin').acquire('T-ungated-shell-0')).resolves.toBeDefined()
  })

  it('fails acquisition when the session-start checkpoint rejects', async () => {
    const runtime = createTerminalRuntime({
      ...createHost(),
      createTerminalView: () => createFakeTerminalView(),
      beforeSessionStart: () => Promise.reject(new Error('checkpoint timed out')),
    })
    const service = createTerminalSessionService(runtime)

    await expect(service.createClient('agent').acquire('T-timeout-shell-0'))
      .rejects.toThrow('checkpoint timed out')
    expect(runtime.hasTerminal('T-timeout-shell-0')).toBe(false)
  })
})

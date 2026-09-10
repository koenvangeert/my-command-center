import { expect, it, vi } from 'vitest'
import { createRestartWorkspaceController } from './restartWorkspaceController'
import { createTerminalRuntime } from '@openforge-app/terminal-runtime'

it('waits for hydration and daemon identity before publishing tabs or consuming the operation', async () => {
  let hydrate!: () => void
  const hydrated = new Promise<void>(resolve => { hydrate = resolve })
  const calls: string[] = []
  const window = { windowId: 'stable-a', navigation: { projectId: 'P-1', taskId: 'T-1', view: 'board' }, tasks: [] }
  const inventory = { controller: { installation: 'installation', lifetime: 'daemon', generation: 2 }, sessions: [{ key: 'T-1-shell-3', instanceId: 9, isLive: true }] }
  const controller = createRestartWorkspaceController({
    load: async () => ({ operationId: 'operation-1', window }),
    inventory: async () => { calls.push('inventory'); return inventory },
    reconcileController: value => { expect(value).toEqual(inventory); calls.push('identity') },
    restoreTabs: (operation, tasks, keys) => { expect([operation, tasks, keys]).toEqual(['operation-1', [], ['T-1-shell-3']]); calls.push('tabs') },
    restoreNavigation: async source => { expect(await source).toEqual(window.navigation); calls.push('navigation') },
    complete: async () => { calls.push('complete') },
  })
  const start = controller.start(hydrated)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(calls).toEqual([])
  hydrate()
  await start
  expect(calls).toEqual(['inventory', 'identity', 'tabs', 'navigation', 'complete'])
  await controller.start(hydrated)
  expect(calls).toHaveLength(5)
})

it('does not consume a restart when inventory reconciliation fails', async () => {
  const complete = vi.fn()
  const restoreTabs = vi.fn()
  const controller = createRestartWorkspaceController({
    load: async () => ({ operationId: 'operation-1', window: { windowId: 'stable-a', navigation: { projectId: null, taskId: null, view: 'board' }, tasks: [] } }),
    inventory: async () => { throw new Error('Daemon unavailable') },
    reconcileController: vi.fn(), restoreTabs,
    restoreNavigation: async source => { await source }, complete,
  })
  await expect(controller.start(Promise.resolve())).rejects.toThrow('Daemon unavailable')
  expect(restoreTabs).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('merges shells created by another window after acknowledgement failed', async () => {
  const runtime = createTerminalRuntime({ environment: { openLink: vi.fn() }, transport: { subscribeSession: vi.fn(), subscribeConnectionRestored: vi.fn(), readReplay: vi.fn(), writeUserInput: vi.fn(), resize: vi.fn(), dispose: vi.fn() } })
  let keys = ['T-1-shell-0']
  const controller = createRestartWorkspaceController({
    load: async () => ({ operationId: 'op', window: { windowId: 'window', navigation: { projectId: null, taskId: null, view: 'board' }, tasks: [{ taskId: 'T-1', tabs: [{ key: keys[0], index: 0, label: 'Saved' }], activeTabIndex: 0, nextIndex: 1 }] } }),
    inventory: async () => ({ controller: { installation: 'i', lifetime: 'l', generation: 1 }, sessions: keys.map((key, index) => ({ key, instanceId: index + 1, isLive: true })) }),
    reconcileController: vi.fn(), restoreTabs: runtime.restoreWorkspace,
    restoreNavigation: async source => { await source },
    complete: vi.fn().mockRejectedValueOnce(new Error('ack failed')).mockResolvedValue(undefined),
  })
  await expect(controller.start(Promise.resolve())).rejects.toThrow('ack failed')
  keys = [...keys, 'T-1-shell-1']
  await controller.start(Promise.resolve())
  expect(runtime.snapshotWorkspace()[0].tabs.map(tab => tab.key)).toEqual(keys)
  expect(runtime.snapshotWorkspace()[0].nextIndex).toBe(2)
  expect(runtime.canAutoStartShell('T-1-shell-1')).toBe(false)
  runtime.dispose()
})

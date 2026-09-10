import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { RestartWorkspaceCoordinator } from './restartWorkspaceCoordinator'
import { RestartWorkspaceStore } from './restartWorkspaceStore'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
it('captures all stable windows durably before allowing controlled replacement, and refuses failed capture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-restart-'))
  roots.push(root)
  const store = new RestartWorkspaceStore(join(root, 'workspace.json'), 'installation-1')
  const coordinator = new RestartWorkspaceCoordinator(store)
  const navigation = { projectId: 'P-1', taskId: null, view: 'board' }
  coordinator.register('window-a', async () => ({ navigation, tasks: [] }))
  const remove = coordinator.register('window-b', async () => { throw new Error('Renderer unavailable') })
  const stop = vi.fn()
  await expect(coordinator.restart('operation-1', stop)).rejects.toThrow('Renderer unavailable')
  expect(stop).not.toHaveBeenCalled()
  expect(await store.load('operation-1')).toBeNull()
  remove()
  coordinator.register('window-b', async () => ({ navigation, tasks: [] }))
  await coordinator.restart('operation-2', async () => {
    expect((await store.load('operation-2'))?.windows.map(window => window.windowId)).toEqual(['window-a', 'window-b'])
    stop()
  })
  expect(stop).toHaveBeenCalledOnce()
})

it('rechecks required windows after asynchronous restart preparation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openforge-restart-window-fence-'))
  roots.push(root)
  const coordinator = new RestartWorkspaceCoordinator(new RestartWorkspaceStore(join(root, 'workspace.json'), 'installation'))
  const remove = coordinator.register('stable-a', async () => ({ navigation: { projectId: null, taskId: null, view: 'board' }, tasks: [] }))
  const replace = vi.fn()
  await expect(coordinator.restart('operation', async assertCurrent => {
    remove()
    assertCurrent()
    replace()
  })).rejects.toThrow(/windows changed/i)
  expect(replace).not.toHaveBeenCalled()
})

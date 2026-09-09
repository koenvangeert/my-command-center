import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RestartWorkspaceStore } from './restartWorkspaceStore'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function store() {
  const root = await mkdtemp(join(tmpdir(), 'openforge-workspace-'))
  roots.push(root)
  return new RestartWorkspaceStore(join(root, 'workspace.json'), 'installation-1')
}
const windows = () => [{
  windowId: 'stable-window-a',
  navigation: { projectId: 'P-1', taskId: 'T-1', view: 'task' },
  tasks: [{ taskId: 'T-1', tabs: [{ index: 4, key: 'T-1-shell-4', label: 'Server' }], activeTabIndex: 4, nextIndex: 7 }],
}, {
  windowId: 'stable-window-b',
  navigation: { projectId: 'P-2', taskId: null, view: 'board' }, tasks: [],
}]

describe('restart workspace persistence', () => {
  it('restores only the matching installation and operation, then consumes all windows durably', async () => {
    const workspace = await store()
    await workspace.capture('operation-1', windows())
    expect(await workspace.load('operation-1')).toEqual({ version: 1, installationId: 'installation-1', operationId: 'operation-1', windows: windows(), restoredWindowIds: [] })
    expect(await workspace.load('other-operation')).toBeNull()
    await workspace.completeWindow('operation-1', 'stable-window-a')
    expect((await workspace.load('operation-1'))?.restoredWindowIds).toEqual(['stable-window-a'])
    await workspace.completeWindow('operation-1', 'stable-window-a')
    await workspace.completeWindow('operation-1', 'stable-window-b')
    expect(await workspace.load('operation-1')).toBeNull()
  })

  it('copies only permitted fields, rejects invalid snapshots, and retains the previous record after failure', async () => {
    const workspace = await store()
    const captured = windows()
    Object.assign(captured[0], { credentials: 'secret', output: 'secret' })
    Object.assign(captured[0].tasks[0].tabs[0], { isLive: true, environment: { TOKEN: 'secret' } })
    await workspace.capture('operation-1', captured)
    expect(await workspace.load('operation-1')).toEqual({ version: 1, installationId: 'installation-1', operationId: 'operation-1', windows: windows(), restoredWindowIds: [] })
    captured[0].tasks[0].tabs[0].key = 'another-task-shell-4'
    await expect(workspace.capture('operation-2', captured)).rejects.toThrow(/workspace/i)
    expect(await workspace.load('operation-1')).not.toBeNull()
  })

  it('refuses corrupt or incompatible records and never loads a foreign installation', async () => {
    const workspace = await store()
    await workspace.capture('operation-1', windows())
    const path = join(roots.at(-1)!, 'workspace.json')
    expect(await new RestartWorkspaceStore(path, 'foreign').load('operation-1')).toBeNull()
    const record = await workspace.load('operation-1')
    for (const content of ['{', JSON.stringify({ ...record, version: 2 }), JSON.stringify({ ...record, windows: [windows()[0], windows()[0]] })]) {
      await writeFile(path, content)
      await expect(workspace.load('operation-1')).rejects.toThrow()
    }
  })

  it('reports a required persistence failure instead of claiming capture succeeded', async () => {
    await store()
    const root = roots.at(-1)!
    await writeFile(join(root, 'not-a-directory'), 'file')
    const workspace = new RestartWorkspaceStore(join(root, 'not-a-directory', 'workspace.json'), 'installation-1')
    await expect(workspace.capture('operation-1', windows())).rejects.toThrow()
  })
})

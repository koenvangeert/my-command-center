import { describe, expect, it } from 'vitest'
import { createStoryTerminalAdapter } from './storyTerminalAdapter'
import { getTerminalOpenForgeApi } from '../../../plugins/terminal/src/lib/ipc'

describe('Terminal story environment', () => {
  it('resets local shell identities and disposes plugin access and transport listeners', async () => {
    const adapter = createStoryTerminalAdapter()
    await adapter.install()
    const api = getTerminalOpenForgeApi()
    expect(await api.shell.spawn({ taskId: 'T-42', terminalIndex: 2, cwd: '/projects/openforge', cols: 80, rows: 24 })).toBe(101)
    const subscription = await adapter.transport.subscribeSession('T-42-shell-2', { onExit() {}, onModelOutput() {}, onModelDisabled() {} })
    subscription.dispose()
    await adapter.reset()
    expect(adapter.transport.resources()).toEqual({ sessions: 0, listeners: 0 })
    expect(await getTerminalOpenForgeApi().shell.spawn({ taskId: 'T-42', terminalIndex: 2, cwd: '/projects/openforge', cols: 80, rows: 24 })).toBe(101)
    await adapter.dispose()
    expect(adapter.transport.resources()).toEqual({ sessions: 0, listeners: 0 })
    expect(() => getTerminalOpenForgeApi()).toThrow('not initialized')
    await expect(api.shell.spawn({ taskId: 'T-42', terminalIndex: 2, cwd: '/', cols: 80, rows: 24 })).rejects.toThrow('disposed')
  })
})

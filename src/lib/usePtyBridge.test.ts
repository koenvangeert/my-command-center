import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('./ipc', () => ({
  getWorktreeForTask: vi.fn().mockResolvedValue(null),
  spawnPty: vi.fn().mockResolvedValue(1),
  spawnClaudePty: vi.fn().mockResolvedValue(2),
  writePty: vi.fn().mockResolvedValue(undefined),
  killPty: vi.fn().mockResolvedValue(undefined),
}))

import { createPtyBridge } from './usePtyBridge.svelte'
import { getWorktreeForTask, spawnPty, spawnClaudePty, killPty } from './ipc'

describe('createPtyBridge', () => {
  let getTerminal: () => { cols: number; rows: number; write: (data: string) => void; focus: () => void } | null
  let setOpencodePort: (port: number) => void
  let onAttached: (sessionStatus?: string) => void
  const taskId = 'T-1'

  beforeEach(() => {
    vi.clearAllMocks()
    getTerminal = vi.fn<() => { cols: number; rows: number; write: (data: string) => void; focus: () => void } | null>().mockReturnValue({ cols: 80, rows: 24, write: vi.fn(), focus: vi.fn() })
    setOpencodePort = vi.fn<(port: number) => void>()
    onAttached = vi.fn<(sessionStatus?: string) => void>()
    vi.mocked(getWorktreeForTask).mockResolvedValue(null)
    vi.mocked(spawnPty).mockResolvedValue(1)
    vi.mocked(spawnClaudePty).mockResolvedValue(2)
    vi.mocked(killPty).mockResolvedValue(undefined)
  })

  it('starts with ptySpawned = false', () => {
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    expect(bridge.ptySpawned).toBe(false)
  })

  it('attachPty does nothing when getWorktreeForTask returns null (opencode)', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue(null)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    expect(bridge.ptySpawned).toBe(false)
    expect(onAttached).not.toHaveBeenCalled()
  })

  it('attachPty spawns PTY when worktree has opencode_port', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ opencode_port: 9000 } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    expect(bridge.ptySpawned).toBe(true)
    expect(spawnPty).toHaveBeenCalledWith(taskId, 9000, 'ses-1', 80, 24)
    expect(onAttached).toHaveBeenCalled()
  })

  it('attachPty calls setOpencodePort with discovered port', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ opencode_port: 9001 } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    expect(setOpencodePort).toHaveBeenCalledWith(9001)
  })

  it('attachPty is idempotent — second call does nothing when already spawned', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ opencode_port: 9000 } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    expect(spawnPty).toHaveBeenCalledTimes(1)
  })

  it('killPty calls ipc killPty and sets ptySpawned to false', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ opencode_port: 9000 } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ opencodeSessionId: 'ses-1' })
    expect(bridge.ptySpawned).toBe(true)
    await bridge.killPty()
    expect(killPty).toHaveBeenCalledWith(taskId)
    expect(bridge.ptySpawned).toBe(false)
  })

  it('writeToPty does not throw', () => {
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    expect(() => bridge.writeToPty('hello')).not.toThrow()
  })

  it('dispose does not throw', () => {
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    expect(() => bridge.dispose()).not.toThrow()
  })

  // Claude Code provider tests
  it('attachPty spawns Claude PTY when provider is claude-code', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ worktree_path: '/tmp/worktree' } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ provider: 'claude-code', claudeSessionId: 'claude-ses-1' })
    expect(bridge.ptySpawned).toBe(true)
    expect(spawnClaudePty).toHaveBeenCalledWith(taskId, '/tmp/worktree', 'claude-ses-1', 80, 24)
    expect(spawnPty).not.toHaveBeenCalled()
    expect(onAttached).toHaveBeenCalled()
  })

  it('attachPty does nothing for claude-code when claudeSessionId is missing', async () => {
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ provider: 'claude-code' })
    expect(bridge.ptySpawned).toBe(false)
    expect(spawnClaudePty).not.toHaveBeenCalled()
    expect(onAttached).not.toHaveBeenCalled()
  })

  it('attachPty skips PTY spawn for claude-code when sessionStatus is running', async () => {
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ provider: 'claude-code', claudeSessionId: 'claude-ses-1', sessionStatus: 'running' })
    expect(bridge.ptySpawned).toBe(false)
    expect(spawnClaudePty).not.toHaveBeenCalled()
    expect(onAttached).toHaveBeenCalledWith('running')
  })

  it('attachPty spawns PTY for claude-code when sessionStatus is completed', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue({ worktree_path: '/tmp/worktree' } as never)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ provider: 'claude-code', claudeSessionId: 'claude-ses-1', sessionStatus: 'completed' })
    expect(bridge.ptySpawned).toBe(true)
    expect(spawnClaudePty).toHaveBeenCalledWith(taskId, '/tmp/worktree', 'claude-ses-1', 80, 24)
  })

  it('attachPty does nothing for claude-code when worktree not found', async () => {
    vi.mocked(getWorktreeForTask).mockResolvedValue(null)
    const bridge = createPtyBridge({ taskId, getTerminal, setOpencodePort, onAttached })
    await bridge.attachPty({ provider: 'claude-code', claudeSessionId: 'claude-ses-1' })
    expect(bridge.ptySpawned).toBe(false)
    expect(spawnClaudePty).not.toHaveBeenCalled()
    expect(onAttached).not.toHaveBeenCalled()
  })
})

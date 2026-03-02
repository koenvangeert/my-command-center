import { render, screen } from '@testing-library/svelte'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writable } from 'svelte/store'

vi.mock('../lib/stores', () => ({
  activeSessions: writable(new Map()),
}))

vi.mock('../lib/ipc', () => ({
  abortImplementation: vi.fn().mockResolvedValue(undefined),
  getLatestSession: vi.fn().mockResolvedValue(null),
  getAgentLogs: vi.fn().mockResolvedValue([]),
  getWorktreeForTask: vi.fn().mockResolvedValue(null),
  transcribeAudio: vi.fn(),
  getWhisperModelStatus: vi.fn().mockResolvedValue({ is_active: false }),
  downloadWhisperModel: vi.fn(),
}))

vi.mock('../lib/useClaudeSession.svelte', () => ({
  useClaudeSession: vi.fn(() => ({
    state: {
      sessionId: null,
      status: 'idle',
      messages: [],
      pendingApprovals: [],
      totalCost: null,
    },
    sendInput: vi.fn(),
    interrupt: vi.fn(),
    resume: vi.fn(),
    approveToolUse: vi.fn(),
    denyToolUse: vi.fn(),
    setup: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
  })),
}))

vi.mock('../lib/audioRecorder', () => ({
  createAudioRecorder: vi.fn(),
}))

import ClaudeAgentPanel from './ClaudeAgentPanel.svelte'
import { activeSessions } from '../lib/stores'
import { useClaudeSession } from '../lib/useClaudeSession.svelte'

describe('ClaudeAgentPanel', () => {
  beforeEach(() => {
    activeSessions.set(new Map())
    vi.mocked(useClaudeSession).mockReturnValue({
      state: {
        sessionId: null,
        status: 'idle',
        messages: [],
        pendingApprovals: [],
        totalCost: null,
      },
      sendInput: vi.fn(),
      interrupt: vi.fn(),
      resume: vi.fn(),
      approveToolUse: vi.fn(),
      denyToolUse: vi.fn(),
      setup: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    })
  })

  it('shows idle status text in the header', () => {
    render(ClaudeAgentPanel, { props: { taskId: 'task-1' } })
    expect(screen.getByText('No active implementation')).toBeTruthy()
  })

  it('renders voice input button', () => {
    render(ClaudeAgentPanel, { props: { taskId: 'task-1' } })
    expect(screen.getByRole('button', { name: 'Start voice input' })).toBeTruthy()
  })

  it('renders chat view and input bar after loading completes', async () => {
    render(ClaudeAgentPanel, { props: { taskId: 'task-1' } })
    await vi.waitFor(() => {
      expect(screen.getByText('No messages yet. Start a session to begin.')).toBeTruthy()
    })
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('shows running status text when session state is running', () => {
    vi.mocked(useClaudeSession).mockReturnValueOnce({
      state: {
        sessionId: 'sess-1',
        status: 'running',
        messages: [],
        pendingApprovals: [],
        totalCost: null,
      },
      sendInput: vi.fn(),
      interrupt: vi.fn(),
      resume: vi.fn(),
      approveToolUse: vi.fn(),
      denyToolUse: vi.fn(),
      setup: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    })
    render(ClaudeAgentPanel, { props: { taskId: 'task-1' } })
    expect(screen.getByText('Agent running...')).toBeTruthy()
  })
})

import { render, screen } from '@testing-library/svelte'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writable } from 'svelte/store'
import type { AgentSession } from '../lib/types'

vi.mock('../lib/stores', () => ({
  activeSessions: writable(new Map()),
}))

vi.mock('../lib/ipc', () => ({
  abortImplementation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

import AgentPanel from './AgentPanel.svelte'
import { activeSessions } from '../lib/stores'

describe('AgentPanel', () => {
  beforeEach(() => {
    activeSessions.set(new Map())
  })

  it('renders empty state text "No active agent session" when idle', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText('No active agent session')).toBeTruthy()
  })

  it('shows guidance text "Start an implementation from the Kanban board context menu"', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText('Start an implementation from the Kanban board context menu')).toBeTruthy()
  })

  it('shows auto-scroll checkbox', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeTruthy()
    expect(screen.getByText('Auto-scroll')).toBeTruthy()
  })

  it('auto-scroll checkbox is checked by default', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('status text shows "No active implementation" when idle', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText('No active implementation')).toBeTruthy()
  })

  it('does not show abort button when idle', () => {
    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.queryByText('Abort')).toBeNull()
  })

  it('shows running session status when session is running', () => {
    const session: AgentSession = {
      id: 'ses-1',
      ticket_id: 'T-1',
      opencode_session_id: null,
      stage: 'implement',
      status: 'running',
      checkpoint_data: null,
      error_message: null,
      created_at: 1000,
      updated_at: 2000,
    }

    const sessions = new Map<string, AgentSession>()
    sessions.set('T-1', session)
    activeSessions.set(sessions)

    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText('Implementing')).toBeTruthy()
    expect(screen.getByText('running')).toBeTruthy()
  })

  it('shows different stage labels for different stages', () => {
    const session: AgentSession = {
      id: 'ses-1',
      ticket_id: 'T-1',
      opencode_session_id: null,
      stage: 'read_ticket',
      status: 'running',
      checkpoint_data: null,
      error_message: null,
      created_at: 1000,
      updated_at: 2000,
    }

    const sessions = new Map<string, AgentSession>()
    sessions.set('T-1', session)
    activeSessions.set(sessions)

    render(AgentPanel, { props: { taskId: 'T-1' } })
    expect(screen.getByText('Reading Ticket')).toBeTruthy()
  })
})

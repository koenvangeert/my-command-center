import { render, screen, fireEvent } from '@testing-library/svelte'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CreaturesView from './CreaturesView.svelte'
import type { Task, AgentSession } from '../lib/types'
import { tasks, activeSessions } from '../lib/stores'

const baseTask: Task = {
  id: 'T-1',
  title: 'Test task',
  status: 'backlog',
  jira_key: null,
  jira_title: null,
  jira_status: null,
  jira_assignee: null,
  jira_description: null,
  project_id: 'proj-1',
  created_at: 1000,
  updated_at: 2000,
}

const makeSession = (taskId: string, status: string, checkpoint_data: string | null = null): AgentSession => ({
  id: `ses-${taskId}`,
  ticket_id: taskId,
  opencode_session_id: null,
  stage: 'implement',
  status,
  checkpoint_data,
  error_message: null,
  created_at: 1000,
  updated_at: 2000,
  provider: 'opencode',
  claude_session_id: null,
})

describe('CreaturesView', () => {
  beforeEach(() => {
    tasks.set([])
    activeSessions.set(new Map())
  })

  it('shows empty state message when no backlog/doing tasks', () => {
    tasks.set([])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })
    expect(screen.getByText('No creatures yet')).toBeTruthy()
  })

  it('shows empty state when only done tasks exist', () => {
    tasks.set([{ ...baseTask, id: 'T-done', status: 'done' }])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })
    expect(screen.getByText('No creatures yet')).toBeTruthy()
  })

  it('renders Creature for doing tasks and shows task ID', () => {
    tasks.set([{ ...baseTask, id: 'T-2', status: 'doing' }])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })
    expect(screen.getByText('T-2')).toBeTruthy()
    expect(screen.queryByText('No creatures yet')).toBeNull()
  })

  it('renders Creature for backlog tasks as eggs and shows task ID', () => {
    tasks.set([{ ...baseTask, id: 'T-3', status: 'backlog' }])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })
    expect(screen.getByText('T-3')).toBeTruthy()
    expect(screen.queryByText('No creatures yet')).toBeNull()
  })

  it('does NOT render done tasks', () => {
    tasks.set([{ ...baseTask, id: 'T-done', status: 'done' }])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })
    expect(screen.queryByText('T-done')).toBeNull()
  })

  it('calls onCreatureClick with task id when creature is clicked', async () => {
    const onCreatureClick = vi.fn()
    tasks.set([{ ...baseTask, id: 'T-5', status: 'doing' }])
    render(CreaturesView, { props: { onCreatureClick } })

    const taskIdEl = screen.getByText('T-5')
    const button = taskIdEl.closest('button')
    if (!button) throw new Error('Creature button not found')
    await fireEvent.click(button)

    expect(onCreatureClick).toHaveBeenCalledWith('T-5')
  })

  it('mixed tasks: doing + backlog + done → only doing + backlog rendered', () => {
    tasks.set([
      { ...baseTask, id: 'T-doing', status: 'doing' },
      { ...baseTask, id: 'T-backlog', status: 'backlog' },
      { ...baseTask, id: 'T-done', status: 'done' },
    ])
    render(CreaturesView, { props: { onCreatureClick: vi.fn() } })

    expect(screen.getByText('T-doing')).toBeTruthy()
    expect(screen.getByText('T-backlog')).toBeTruthy()
    expect(screen.queryByText('T-done')).toBeNull()
    expect(screen.queryByText('No creatures yet')).toBeNull()
  })

  it('passes session to creature for active doing task', () => {
    tasks.set([{ ...baseTask, id: 'T-active', status: 'doing' }])
    activeSessions.set(new Map([['T-active', makeSession('T-active', 'running')]]))
    const { container } = render(CreaturesView, { props: { onCreatureClick: vi.fn() } })

    const svg = container.querySelector('svg')
    expect(svg?.classList.contains('creature-bounce')).toBe(true)
  })
})

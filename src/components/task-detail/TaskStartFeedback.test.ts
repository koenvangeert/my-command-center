import { render, screen, fireEvent } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeSessions, startingTasks, taskStartErrors } from '../../lib/stores'
import TaskStartFeedback from './TaskStartFeedback.svelte'

beforeEach(() => {
  startingTasks.set(new Set())
  taskStartErrors.set(new Map())
  activeSessions.set(new Map())
})

describe('Task startup feedback', () => {
  it('shows pending startup instead of a retry while an attempt is active', () => {
    startingTasks.set(new Set(['T-1']))
    taskStartErrors.set(new Map([['T-1', 'previous error']]))
    render(TaskStartFeedback, { taskId: 'T-1', onRunAction: vi.fn() })
    expect(screen.getByRole('status').textContent).toContain('Starting task')
    expect(screen.queryByRole('button', { name: 'Retry start' })).toBeNull()
  })

  it('retries the displayed task and does not show another task’s failure', async () => {
    const onRunAction = vi.fn()
    taskStartErrors.set(new Map([['T-1', 'provider offline'], ['T-2', 'other error']]))
    const view = render(TaskStartFeedback, { taskId: 'T-1', onRunAction })
    expect(screen.getByRole('alert').textContent).toContain('provider offline')
    expect(screen.queryByText('other error')).toBeNull()
    await fireEvent.click(screen.getByRole('button', { name: 'Retry start' }))
    expect(onRunAction).toHaveBeenCalledExactlyOnceWith({ taskId: 'T-1', actionPrompt: '' })
    await view.rerender({ taskId: 'T-3', onRunAction })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not offer retry for a task that already has a running session', () => {
    taskStartErrors.set(new Map([['T-1', 'stale error']]))
    activeSessions.set(new Map([['T-1', { status: 'running' } as never]]))
    render(TaskStartFeedback, { taskId: 'T-1', onRunAction: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Retry start' })).toBeNull()
  })
})

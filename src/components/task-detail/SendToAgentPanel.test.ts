import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrComment, ReviewSubmissionComment } from '../../lib/types'
import SendToAgentPanel from './SendToAgentPanel.svelte'


describe('SendToAgentPanel', () => {
  const inlineComments: ReviewSubmissionComment[] = [
    { path: 'src/task.ts', line: 12, side: 'RIGHT', body: 'task scoped feedback' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses task-scoped pending inline comments for the send affordance', () => {
    render(SendToAgentPanel, {
      props: {
        agentStatus: null,
        onSendToAgent: vi.fn(),
        onRefresh: vi.fn(),
        pendingInlineComments: inlineComments,
      },
    })

    expect((screen.getByRole('button', { name: 'Send feedback (1)' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('keeps inline comments while previewing, then clears them on confirm', async () => {
    const onPendingInlineCommentsChange = vi.fn()
    const onSendToAgent = vi.fn()
    render(SendToAgentPanel, {
      props: {
        agentStatus: null,
        onSendToAgent,
        onRefresh: vi.fn(),
        pendingInlineComments: inlineComments,
        onPendingInlineCommentsChange,
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement

    expect(onPendingInlineCommentsChange).not.toHaveBeenCalled()
    expect(onSendToAgent).not.toHaveBeenCalled()
    expect(textarea.value).toContain('Please address the following review comments:')
    expect(textarea.value).toContain('task scoped feedback')
    expect(textarea.value).not.toContain('for task')

    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))
    expect(onPendingInlineCommentsChange).toHaveBeenCalledWith([])
    expect(onSendToAgent).toHaveBeenCalledWith(textarea.value)
  })

  it('regenerates the prompt when toggling between Address and Analyze modes', async () => {
    const onSendToAgent = vi.fn()
    render(SendToAgentPanel, {
      props: {
        agentStatus: null,
        onSendToAgent,
        onRefresh: vi.fn(),
        pendingInlineComments: inlineComments,
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement

    // Default is Address.
    expect(textarea.value).toContain('Please address the following review comments:')
    expect(textarea.value).not.toContain('Please analyze')

    // Toggle to Analyze regenerates the prompt.
    await fireEvent.click(screen.getByText('Analyze'))
    expect(textarea.value).toContain('Please analyze the following review comments')
    expect(textarea.value).not.toContain('Please address the following review comments:')

    // Sending uses the current (Analyze) prompt.
    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))
    expect(onSendToAgent).toHaveBeenCalledWith(expect.stringContaining('Please analyze'))
  })

  it('sends the edited prompt text, not the original', async () => {
    const onSendToAgent = vi.fn()
    render(SendToAgentPanel, {
      props: {
        agentStatus: null,
        onSendToAgent,
        onRefresh: vi.fn(),
        pendingInlineComments: inlineComments,
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await fireEvent.input(textarea, { target: { value: 'my edited prompt' } })
    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))

    expect(onSendToAgent).toHaveBeenCalledWith('my edited prompt')
  })

  it('does not send when the dialog is cancelled', async () => {
    const onSendToAgent = vi.fn()
    const onPendingInlineCommentsChange = vi.fn()
    render(SendToAgentPanel, {
      props: {
        agentStatus: null,
        onSendToAgent,
        onRefresh: vi.fn(),
        pendingInlineComments: inlineComments,
        onPendingInlineCommentsChange,
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    await screen.findByRole('textbox')
    await fireEvent.click(screen.getByText('Cancel'))

    expect(onPendingInlineCommentsChange).not.toHaveBeenCalled()
    expect(onSendToAgent).not.toHaveBeenCalled()
  })

  it('preserves inline feedback added or edited after the preview opened', async () => {
    const onPendingInlineCommentsChange = vi.fn()
    const onSendToAgent = vi.fn()
    const original = { ...inlineComments[0] }
    const view = render(SendToAgentPanel, {
      agentStatus: null, onSendToAgent, onRefresh: vi.fn(),
      pendingInlineComments: [original], onPendingInlineCommentsChange,
    })
    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    const edited = { ...original, body: 'updated feedback' }
    const added: ReviewSubmissionComment = { path: 'src/new.ts', line: 4, side: 'RIGHT', body: 'new feedback' }
    await view.rerender({ pendingInlineComments: [edited, added] })
    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))
    expect(onSendToAgent).toHaveBeenCalledWith(expect.stringContaining(original.body))
    expect(onSendToAgent).not.toHaveBeenCalledWith(expect.stringContaining(added.body))
    expect(onPendingInlineCommentsChange).toHaveBeenCalledWith([edited, added])
  })

  it('preserves an additional identical inline comment added after capture', async () => {
    const original = inlineComments[0]
    const onPendingInlineCommentsChange = vi.fn()
    const view = render(SendToAgentPanel, {
      agentStatus: null, onSendToAgent: vi.fn(), onRefresh: vi.fn(),
      pendingInlineComments: [original], onPendingInlineCommentsChange,
    })
    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    await view.rerender({ pendingInlineComments: [original, { ...original }] })
    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))
    expect(onPendingInlineCommentsChange).toHaveBeenCalledWith([original])
  })

  it.each([false, true])('only completes unchanged captured GitHub selections, edited=%s', async (edited) => {
    const original: PrComment = { id: 1, pr_id: 1, author: 'alice', body: 'original review', comment_type: 'review_comment', file_path: 'src/task.ts', line_number: 12, addressed: 0, outdated: 0, created_at: 1000 }
    const onSendComplete = vi.fn()
    const onSendToAgent = vi.fn()
    const view = render(SendToAgentPanel, { agentStatus: null, onSendToAgent, onRefresh: vi.fn(), selectedPrComments: [original], onSendComplete })
    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    const current = edited ? { ...original, body: 'updated review' } : original
    const added = { ...original, id: 2, body: 'newly selected review' }
    await view.rerender({ selectedPrComments: [current, added] })
    await fireEvent.click(screen.getByTestId('confirm-send-prompt'))
    expect(onSendToAgent).toHaveBeenCalledWith(expect.stringContaining(original.body))
    expect(onSendToAgent).not.toHaveBeenCalledWith(expect.stringContaining(added.body))
    expect(onSendComplete).toHaveBeenCalledWith(edited ? [] : [original.id])
  })

  it.each([
    { inline: 0, pr: 0, status: null, label: 'Send feedback (0)', disabled: true, reason: 'Add comments before sending' },
    { inline: 1, pr: 0, status: null, label: 'Send feedback (1)', disabled: false, reason: 'Review and send feedback to agent' },
    { inline: 0, pr: 1, status: null, label: 'Send feedback (1)', disabled: false, reason: 'Review and send feedback to agent' },
    { inline: 1, pr: 1, status: null, label: 'Send feedback (2)', disabled: false, reason: 'Review and send feedback to agent' },
    { inline: 1, pr: 1, status: 'running', label: 'Send feedback (2)', disabled: true, reason: 'Agent is currently running' },
    { inline: 1, pr: 1, status: 'paused', label: 'Send feedback (2)', disabled: true, reason: 'Agent is currently paused' },
  ])('reports review-bar eligibility for $label with agent $status', ({ inline, pr, status, label, disabled, reason }) => {
    const comment: PrComment = { id: 1, pr_id: 1, author: 'alice', body: 'review', comment_type: 'review_comment', file_path: 'src/task.ts', line_number: 12, addressed: 0, outdated: 0, created_at: 1000 }
    render(SendToAgentPanel, { agentStatus: status, onSendToAgent: vi.fn(), onRefresh: vi.fn(), pendingInlineComments: inline ? inlineComments : [], selectedPrComments: pr ? [comment] : [] })
    const button = screen.getByRole('button', { name: label }) as HTMLButtonElement
    expect(button.disabled).toBe(disabled)
    expect(button.title).toBe(reason)
  })

  it('does not confirm a preview if the agent becomes busy', async () => {
    const onSendToAgent = vi.fn()
    const view = render(SendToAgentPanel, { agentStatus: null, onSendToAgent, onRefresh: vi.fn(), pendingInlineComments: inlineComments })
    await fireEvent.click(screen.getByRole('button', { name: /Send feedback/ }))
    await view.rerender({ agentStatus: 'running' })
    const confirm = screen.getByTestId('confirm-send-prompt') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    await fireEvent.click(confirm)
    expect(onSendToAgent).not.toHaveBeenCalled()
  })
})

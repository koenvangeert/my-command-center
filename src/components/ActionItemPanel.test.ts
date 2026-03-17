import { render, screen, fireEvent } from '@testing-library/svelte'
import { describe, it, expect, vi } from 'vitest'
import ActionItemPanel from './ActionItemPanel.svelte'
import type { ActionItem } from '../lib/types'

function makeItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: 1,
    project_id: 'P-1',
    source: 'shepherd',
    title: 'Review failing CI',
    description: 'CI pipeline failed on main branch',
    task_id: null,
    status: 'active',
    created_at: 1700000000,
    dismissed_at: null,
    ...overrides,
  }
}

function renderPanel(items: ActionItem[], onDismiss = vi.fn(), onNavigateToTask = vi.fn()) {
  return render(ActionItemPanel, {
    props: { items, onDismiss, onNavigateToTask },
  })
}

describe('ActionItemPanel', () => {
  it('renders "No action items" when items array is empty', () => {
    renderPanel([])
    expect(screen.getByText('No action items')).toBeTruthy()
  })

  it('renders item title and description when items provided', () => {
    const item = makeItem({ title: 'Fix broken test', description: 'Test suite is failing' })
    renderPanel([item])
    expect(screen.getByText('Fix broken test')).toBeTruthy()
    expect(screen.getByText('Test suite is failing')).toBeTruthy()
  })

  it('calls onDismiss with correct id when dismiss button clicked', async () => {
    const onDismiss = vi.fn()
    const item = makeItem({ id: 42 })
    renderPanel([item], onDismiss)
    const dismissBtn = screen.getByLabelText('Dismiss')
    await fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledWith(42)
  })

  it('calls onNavigateToTask with correct taskId when task link clicked', async () => {
    const onNavigateToTask = vi.fn()
    const item = makeItem({ task_id: 'T-99' })
    renderPanel([item], vi.fn(), onNavigateToTask)
    const taskLink = screen.getByText('→ T-99')
    await fireEvent.click(taskLink)
    expect(onNavigateToTask).toHaveBeenCalledWith('T-99')
  })

  it('does NOT render task link when task_id is null', () => {
    const item = makeItem({ task_id: null })
    renderPanel([item])
    expect(screen.queryByText(/→/)).toBeNull()
  })

  it('renders badge with item count when items present', () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2 })]
    renderPanel(items)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('does not render badge when no items', () => {
    renderPanel([])
    expect(screen.queryByText('0')).toBeNull()
  })
})

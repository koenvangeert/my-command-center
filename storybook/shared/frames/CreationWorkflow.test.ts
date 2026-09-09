import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { creationScenario } from '../fixtures/creationScenario'
import CreationWorkflow from './CreationWorkflow.svelte'

const disposals: Array<() => Promise<void>> = []
afterEach(async () => {
  cleanup()
  for (const dispose of disposals.splice(0).reverse()) await dispose()
})

async function mountWorkflow(workflow: 'task' | 'project' = 'task', state = 'default') {
  const definition = creationScenario(workflow, state)
  const desktop = createStoryDesktopAdapter(definition.desktop)
  const environment = createStoryEnvironment({
    id: `creation-${workflow}-${state}`, now: '2026-01-02T09:30:00Z',
    adapters: [desktop, ...(definition.adapters?.() ?? [])],
  })
  await environment.install()
  disposals.push(() => environment.dispose())
  const onClose = vi.fn(), onTaskCreated = vi.fn(), onTaskSaved = vi.fn(), onProjectCreated = vi.fn()
  const view = render(CreationWorkflow, {
    workflow, state, onClose, onTaskCreated, onTaskSaved, onProjectCreated, reset: () => environment.reset(),
  })
  return { ...view, desktop, environment, onClose, onTaskCreated, onTaskSaved, onProjectCreated }
}

it('creates a backlog task with inherited defaults and reopens with a fresh draft', async () => {
  const { desktop, onTaskCreated, onClose } = await mountWorkflow()
  const prompt = screen.getByRole('textbox', { name: 'What should the agent do?' })
  expect(screen.getByRole('button', { name: 'Add to backlog' })).toBeDisabled()
  await fireEvent.input(prompt, { target: { value: 'Review keyboard navigation' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to backlog' })).toBeEnabled())
  await fireEvent.click(screen.getByRole('button', { name: 'Add to backlog' }))
  await waitFor(() => expect(onTaskCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-99' }), 'backlog'))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(desktop.calls).toContainEqual({ command: 'create_task', payload: expect.objectContaining({
    initialPrompt: 'Review keyboard navigation', projectId: 'project-1', status: 'backlog', aiProvider: 'codex',
  }) })
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'What should the agent do?' })).toHaveValue(''))
  expect(desktop.calls.some(call => call.command === 'create_task')).toBe(false)
})

it('keeps an edited prompt after a backend failure without transferring ownership', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const { desktop, onTaskCreated, onClose } = await mountWorkflow('task', 'failure')
    await fireEvent.input(screen.getByRole('textbox', { name: 'What should the agent do?' }), { target: { value: 'Keep this draft' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to backlog' })).toBeEnabled())
    await fireEvent.click(screen.getByRole('button', { name: 'Add to backlog' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog task creation unavailable')
    expect(screen.getByRole('textbox', { name: 'What should the agent do?' })).toHaveValue('Keep this draft')
    expect(onTaskCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(desktop.calls.filter(call => call.command === 'create_task')).toHaveLength(1)
    expect(errors.mock.calls).toEqual([['Failed to save task:', 'Catalog task creation unavailable']])
  } finally { errors.mockRestore() }
})

it('saves a backlog prompt edit through the production update boundary', async () => {
  const { desktop, onTaskSaved, onTaskCreated } = await mountWorkflow('task', 'edit')
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeTruthy()
  await fireEvent.input(screen.getByRole('textbox', { name: 'What should the agent do?' }), { target: { value: 'Revised acceptance criteria' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(onTaskSaved).toHaveBeenCalledTimes(1))
  expect(onTaskCreated).not.toHaveBeenCalled()
  expect(desktop.calls).toContainEqual({ command: 'update_task', payload: { id: 'T-42', initialPrompt: 'Revised acceptance criteria' } })
})

it('creates a project from a chosen folder and cancellation resets its name', async () => {
  const { desktop, onProjectCreated } = await mountWorkflow('project')
  expect(screen.getByRole('button', { name: 'Create Project' })).toBeDisabled()
  await fireEvent.click(screen.getByRole('button', { name: /Select repository/i }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project Name' })).toHaveValue('catalog-project'))
  await fireEvent.click(screen.getByRole('button', { name: 'Create Project' }))
  await waitFor(() => expect(onProjectCreated).toHaveBeenCalledWith(expect.objectContaining({ name: 'catalog-project' })))
  expect(desktop.calls).toContainEqual({ command: 'create_project', payload: { name: 'catalog-project', path: '/workspace/catalog-project' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
  await fireEvent.click(await screen.findByRole('radio', { name: /New repo/ }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project Name' })).toHaveValue(''))
  await fireEvent.input(screen.getByRole('textbox', { name: 'Project Name' }), { target: { value: 'Unsaved name' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
  await fireEvent.click(await screen.findByRole('radio', { name: /New repo/ }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project Name' })).toHaveValue(''))
})

it('holds creation disabled until defaults resolve and prevents duplicate submissions while saving', async () => {
  const { desktop, onTaskCreated } = await mountWorkflow('task', 'loading')
  await fireEvent.input(screen.getByRole('textbox', { name: 'What should the agent do?' }), { target: { value: 'Wait for defaults' } })
  expect(screen.getByText('Loading task defaults…')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add to backlog' })).toBeDisabled()
  desktop.release('resolve_ai_provider')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to backlog' })).toBeEnabled())
  desktop.defer('create_task')
  await fireEvent.click(screen.getByRole('button', { name: /Start Task/ }))
  expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  expect(onTaskCreated).not.toHaveBeenCalled()
  desktop.release('create_task')
  await waitFor(() => expect(onTaskCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'T-99' }), 'start'))
  expect(desktop.calls.filter(call => call.command === 'create_task')).toHaveLength(1)
})

it('does not deliver pending creation callbacks after its story host is destroyed', async () => {
  const { unmount, environment, onTaskCreated, onClose } = await mountWorkflow('task', 'saving')
  await waitFor(() => expect(screen.getByRole('button', { name: /Start Task/ })).toBeEnabled())
  await fireEvent.click(screen.getByRole('button', { name: /Start Task/ }))
  await screen.findByRole('button', { name: 'Starting…' })
  unmount()
  await environment.dispose()
  expect(onTaskCreated).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

it('restores the page layout when a cancelled creation dialog is reopened', async () => {
  await mountWorkflow()
  await fireEvent.keyDown(screen.getByRole('textbox', { name: 'What should the agent do?' }), { key: 'Escape' })
  await fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
  await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
  await screen.findByRole('dialog', { name: 'Create task' })
  expect(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true })).toBeTruthy()
})

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { activeProjectId, selectedTaskId, pendingTask, currentView } from '../../../src/lib/stores'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { navigationScenario } from '../fixtures/navigationScenario'
import NavigationWorkflow from './NavigationWorkflow.svelte'

const disposals: Array<() => Promise<void>> = []
afterEach(async () => {
  cleanup()
  for (const dispose of disposals.splice(0).reverse()) await dispose()
})

async function mountWorkflow(workflow: 'projects' | 'commands' | 'actions' | 'files', state = 'populated') {
  const definition = navigationScenario(workflow, state)
  const desktop = createStoryDesktopAdapter(definition.desktop)
  const environment = createStoryEnvironment({
    id: `navigation-${workflow}-${state}`, now: '2026-01-02T09:30:00Z',
    adapters: [desktop, ...(definition.adapters?.() ?? [])],
  })
  await environment.install()
  disposals.push(() => environment.dispose())
  const onSelectProject = vi.fn()
  const onClose = vi.fn()
  const onExecute = vi.fn()
  const view = render(NavigationWorkflow, {
    workflow, state, onSelectProject, onClose, onExecute, reset: () => environment.reset(),
  })
  return { ...view, desktop, environment, onSelectProject, onClose, onExecute }
}

describe('navigation catalog workflows', () => {
  it('switches projects through the public callback and reopens with the original query and project', async () => {
    const { onSelectProject, onClose } = await mountWorkflow('projects')
    const input = screen.getByPlaceholderText('Switch project...')
    await fireEvent.input(input, { target: { value: 'docs' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onSelectProject).toHaveBeenCalledWith('project-2'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(get(activeProjectId)).toBe('project-2')
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Switch project...')).toHaveValue(''))
    expect(get(activeProjectId)).toBe('project-1')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })
  it('finds a Task in another project and resets navigation when reopened', async () => {
    const { onClose } = await mountWorkflow('commands')
    const input = screen.getByPlaceholderText('Search tasks or commands...')
    await screen.findByRole('option', { name: /Write contributor docs/ })
    await fireEvent.input(input, { target: { value: 'docs' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(get(activeProjectId)).toBe('project-2')
    expect(get(selectedTaskId)).toBe('T-43')
    expect(get(pendingTask)?.id).toBe('T-43')
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await screen.findByRole('option', { name: /Write contributor docs/ })
    expect(screen.getByPlaceholderText('Search tasks or commands...')).toHaveValue('')
    expect(get(selectedTaskId)).toBeNull()
    expect(get(pendingTask)).toBeNull()
    expect(get(activeProjectId)).toBe('project-1')
  })
  it('executes a filtered action and restores available actions on reopening', async () => {
    const { onExecute } = await mountWorkflow('actions', 'backlog')
    const input = screen.getByPlaceholderText('Type an action...')
    expect(screen.queryByRole('option', { name: /Run App/i })).toBeNull()
    await fireEvent.input(input, { target: { value: 'start' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith('start-task', undefined))
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Type an action...')).toHaveValue(''))
    expect(screen.getByRole('option', { name: /Start Task/i })).toBeTruthy()
    await fireEvent.input(screen.getByPlaceholderText('Type an action...'), { target: { value: 'no-such-action' } })
    expect(screen.getByRole('status')).toHaveTextContent('No actions match your search')
  })
  it('reveals a searched file through the local command adapter and resets on reopening', async () => {
    const { desktop, onClose } = await mountWorkflow('files')
    const input = screen.getByPlaceholderText('Search files...')
    await fireEvent.input(input, { target: { value: 'ts' } })
    await screen.findByRole('option', { name: /navigation.ts/ })
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(desktop.calls).toContainEqual({ command: 'set_config', payload: {
      key: 'catalog.lastCommand', value: JSON.stringify({ id: 'revealFile', payload: { path: 'src/search.ts' } }),
    } })
    expect(get(currentView)).toBe('plugin:com.openforge.file-viewer:files')
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await waitFor(() => expect(screen.getByPlaceholderText('Search files...')).toHaveValue(''))
    expect(screen.getByRole('status')).toHaveTextContent('Type to search files...')
    expect(get(currentView)).toBe('board')
    expect(desktop.calls.some(call => call.command === 'set_config')).toBe(false)
  })
  it('runs a discoverable plugin command without activating a live plugin', async () => {
    const { desktop, onClose } = await mountWorkflow('commands')
    const input = screen.getByPlaceholderText('Search tasks or commands...')
    await screen.findByRole('option', { name: /Refresh catalog index/ })
    await fireEvent.input(input, { target: { value: 'catalog' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(desktop.calls).toContainEqual({ command: 'set_config', payload: {
      key: 'catalog.lastCommand', value: JSON.stringify({ id: 'refresh-index' }),
    } })
    expect(desktop.calls.some(call => call.command.includes('activate'))).toBe(false)
  })
  it('resets the host layout when a dismissed workflow is reopened', async () => {
    await mountWorkflow('projects')
    await fireEvent.keyDown(screen.getByPlaceholderText('Switch project...'), { key: 'Escape' })
    await fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await screen.findByRole('dialog', { name: 'Switch project' })
    expect(screen.getByRole('button', { name: 'Collapse sidebar', hidden: true })).toBeTruthy()
  })
  it('requires merge confirmation and forgets pending confirmation on reopening', async () => {
    const { onExecute } = await mountWorkflow('actions', 'merge')
    await fireEvent.click(screen.getByRole('option', { name: /Squash and merge PR #42/ }))
    expect(onExecute).not.toHaveBeenCalled()
    await fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm' }), { key: 'Enter' })
    expect(onExecute).toHaveBeenCalledWith('merge-pr:squash', 'squash')
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen workflow' }))
    await screen.findByPlaceholderText('Type an action...')
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, expect, it, vi } from 'vitest'
import ProjectSetupDialog from './ProjectSetupDialog.svelte'
import { invokeDesktopCommand } from '../../lib/desktopIpc'
import type { Project } from '../../lib/types'

vi.mock('../../lib/desktopIpc', () => ({ invokeDesktopCommand: vi.fn() }))

const project: Project = {
  id: 'project-created', name: 'my-project', path: '/repos/my-project',
  created_at: 1, updated_at: 1,
}

afterEach(() => vi.restoreAllMocks())

it.each([
  { mode: 'From GitHub', command: 'create_project_from_git' },
  { mode: 'New repo', command: 'create_project_from_new_repo' },
])('opens the created project when remembering the folder fails in $mode', async ({ mode, command }) => {
  const persistenceError = new Error('Could not save configuration')
  const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(invokeDesktopCommand).mockImplementation(async (name) => {
    if (name === 'get_config') return ' /repos '
    if (name === command) return project
    if (name === 'set_config') throw persistenceError
    throw new Error(`Unexpected command: ${name}`)
  })
  const onProjectCreated = vi.fn()
  render(ProjectSetupDialog, { onProjectCreated })
  const dialog = screen.getByRole('dialog', { name: 'Add Project' })
  await fireEvent.click(within(dialog).getByRole('radio', { name: new RegExp(mode) }))
  if (mode === 'From GitHub') {
    await fireEvent.input(within(dialog).getByRole('textbox', { name: 'Repository URL' }), {
      target: { value: 'https://github.com/owner/my-project' },
    })
  }
  await fireEvent.input(within(dialog).getByRole('textbox', { name: 'Project Name' }), {
    target: { value: 'my-project' },
  })
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Create Project' }))

  await waitFor(() => expect(onProjectCreated).toHaveBeenCalledExactlyOnceWith(project))
  expect(invokeDesktopCommand).toHaveBeenCalledWith('set_config', {
    key: 'default_repositories_dir', value: '/repos',
  })
  expect(within(dialog).getByRole('status').textContent).toContain('Project created')
  expect(within(dialog).queryByRole('alert')).toBeNull()
  expect(logError).toHaveBeenCalledWith('Failed to save default repositories directory:', persistenceError)
})

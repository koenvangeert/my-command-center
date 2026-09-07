import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProjectConfig } from '../../../src/lib/ipc'
import SettingsPage from '../frames/SettingsPage.svelte'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { createStoryEnvironment, type StoryEnvironment } from '../environment/storyEnvironment'
import { settingsScenario } from './settingsScenario'

let environment: StoryEnvironment | undefined
afterEach(async () => {
  cleanup()
  await environment?.dispose()
})

describe('settings catalog environment', () => {
  it('persists project edits through the desktop boundary and resets before remount', async () => {
    const definition = settingsScenario('project')
    const desktop = createStoryDesktopAdapter(definition.desktop)
    environment = createStoryEnvironment({
      id: 'settings-persistence', now: '2026-01-02T09:30:00Z',
      adapters: [desktop, ...(definition.adapters?.() ?? [])],
    })
    await environment.install()
    render(SettingsPage, { mode: 'project' })
    await waitFor(() => expect(screen.queryByText('Loading settings…')).toBeNull())
    await fireEvent.input(screen.getByRole('textbox', { name: 'Run Command' }), { target: { value: 'pnpm preview' } })
    await screen.findByText('All changes saved')
    expect(await getProjectConfig('project-1', 'run_command')).toBe('pnpm preview')
    cleanup()
    await environment.reset()
    render(SettingsPage, { mode: 'project' })
    await waitFor(() => expect(screen.queryByText('Loading settings…')).toBeNull())
    expect(screen.getByRole('textbox', { name: 'Run Command' })).toHaveValue('pnpm dev')
    expect(await getProjectConfig('project-1', 'run_command')).toBe('pnpm dev')
  })

  it('keeps global settings disabled until the declared load finishes', async () => {
    const definition = settingsScenario('global', 'loading')
    const desktop = createStoryDesktopAdapter(definition.desktop)
    environment = createStoryEnvironment({
      id: 'settings-loading', now: '2026-01-02T09:30:00Z',
      adapters: [desktop, ...(definition.adapters?.() ?? [])],
    })
    await environment.install()
    render(SettingsPage, { mode: 'global' })
    expect(await screen.findByText('Loading settings…')).toBeVisible()
    // The scenario must hold loading, not merely catch the first render before hydration.
    await new Promise(resolve => setTimeout(resolve, 30))
    const prefix = screen.getByRole('textbox', { name: /Task ID Prefix/i })
    expect(prefix).toBeDisabled()
    desktop.release('get_config')
    await waitFor(() => expect(prefix).toBeEnabled())
    await fireEvent.input(prefix, { target: { value: 'TEAM' } })
    await screen.findByText('All changes saved')
    expect(await desktop.bridge.invoke('get_config', { key: 'task_id_prefix' })).toBe('TEAM')
  })

  it('settles an in-flight project save before removing the desktop environment', async () => {
    const definition = settingsScenario('project', 'saving')
    const desktop = createStoryDesktopAdapter(definition.desktop)
    environment = createStoryEnvironment({
      id: 'settings-saving-teardown', now: '2026-01-02T09:30:00Z',
      adapters: [desktop, ...(definition.adapters?.() ?? [])],
    })
    const diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await environment.install()
      render(SettingsPage, { mode: 'project' })
      await waitFor(() => expect(screen.queryByText('Loading settings…')).toBeNull())
      await fireEvent.input(screen.getByRole('textbox', { name: 'Project Name' }), { target: { value: 'Edited project' } })
      await screen.findByText('Saving changes…')
      cleanup()
      await environment.dispose()
      // Let the released desktop response finish its chained settings writes.
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(diagnostics).not.toHaveBeenCalled()
    } finally {
      diagnostics.mockRestore()
    }
  })

  it.each([
    ['project', 'Agents & tasks', 'Project configuration'],
    ['project', 'Labels', 'Task Labels'],
    ['project', 'Focus filter', 'Focus Filter States'],
    ['project', 'AI instructions', 'AI Instructions'],
    ['project', 'Plugins', 'Project dashboard'],
    ['project', 'Danger Zone', 'Danger Zone'],
    ['global', 'Agents', 'Global defaults'],
    ['global', 'GitHub & Credentials', 'Credentials'],
    ['global', 'Voice & Whisper', 'Voice & Whisper'],
    ['global', 'Plugins', 'Default project dashboard'],
    ['global', 'Companion', 'Companion'],
    ['global', 'Developer logs', 'Developer'],
  ] as const)('renders %s / %s without undeclared desktop responses', async (mode, category, heading) => {
    const definition = settingsScenario(mode)
    const desktop = createStoryDesktopAdapter(definition.desktop)
    environment = createStoryEnvironment({
      id: 'settings-navigation', now: '2026-01-02T09:30:00Z',
      adapters: [desktop, ...(definition.adapters?.() ?? [])],
    })
    await environment.install()
    render(SettingsPage, { mode })
    await waitFor(() => expect(screen.queryByText('Loading settings…')).toBeNull())
    await fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${category}`) }))
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    await new Promise(resolve => setTimeout(resolve, 100))
    const configCommands = ['get_config', 'get_project_config']
    expect(desktop.calls.map(call => call.command).filter(command =>
      !configCommands.includes(command) && !Object.hasOwn(definition.desktop?.responses ?? {}, command),
    )).toEqual([])
  })
})

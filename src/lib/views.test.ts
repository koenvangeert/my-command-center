import { describe, expect, it, vi } from 'vitest'
import { ICON_RAIL_HIDDEN_VIEWS, ICON_RAIL_NAV_ITEMS, NAVIGATION_SHORTCUT_ITEMS, TASK_CLEARING_VIEWS, VIEWS } from './views'

describe('views registry', () => {
  it('registers all non-board top-level views', () => {
    expect(Object.keys(VIEWS).sort()).toEqual([
      'files',
      'global_settings',
      'pr_review',
      'settings',
      'skills',
      'workqueue',
    ])
  })

  it('builds props for settings views correctly', () => {
    const onCloseSettings = vi.fn()
    const onProjectDeleted = vi.fn()
    const onRunAction = vi.fn()

    const settingsProps = VIEWS.settings.getProps({
      projectName: 'Project Alpha',
      onCloseSettings,
      onProjectDeleted,
      onRunAction,
    })
    const globalSettingsProps = VIEWS.global_settings.getProps({
      projectName: 'Project Alpha',
      onCloseSettings,
      onProjectDeleted,
      onRunAction,
    })

    expect(settingsProps).toMatchObject({
      mode: 'project',
      onClose: onCloseSettings,
      onProjectDeleted,
    })
    expect(globalSettingsProps).toMatchObject({
      mode: 'global',
      onClose: onCloseSettings,
      onProjectDeleted,
    })
  })

  it('tracks navigation metadata for view behavior', () => {
    expect([...TASK_CLEARING_VIEWS].sort()).toEqual([
      'files',
      'global_settings',
      'pr_review',
      'settings',
      'workqueue',
    ])

    expect([...ICON_RAIL_HIDDEN_VIEWS].sort()).toEqual([
      'global_settings',
      'workqueue',
    ])
  })

  it('exposes shared navigation metadata for icon rail items and app shortcuts', () => {
    expect(ICON_RAIL_NAV_ITEMS.map(({ view, label, shortcutHint }) => ({ view, label, shortcutHint }))).toEqual([
      { view: 'board', label: 'Board', shortcutHint: 'H' },
      { view: 'files', label: 'Files', shortcutHint: 'O' },
      { view: 'pr_review', label: 'Pull Requests', shortcutHint: 'G' },
      { view: 'skills', label: 'Skills', shortcutHint: 'L' },
      { view: 'settings', label: 'Settings', shortcutHint: ',' },
    ])

    expect(NAVIGATION_SHORTCUT_ITEMS.map(({ view, shortcutKey }) => ({ view, shortcutKey }))).toEqual([
      { view: 'board', shortcutKey: 'h' },
      { view: 'files', shortcutKey: 'o' },
      { view: 'pr_review', shortcutKey: 'g' },
      { view: 'skills', shortcutKey: 'l' },
      { view: 'settings', shortcutKey: ',' },
      { view: 'workqueue', shortcutKey: 'r' },
    ])
  })
})

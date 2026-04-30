import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { validatePluginManifest } from '@openforge/plugin-sdk'
import manifest from '../manifest.json'

const terminalSrcDir = dirname(fileURLToPath(import.meta.url))

const { mockTerminalTaskPane, mockTerminalProjectView } = vi.hoisted(() => ({
  mockTerminalTaskPane: { name: 'TerminalTaskPaneComponent' },
  mockTerminalProjectView: { name: 'TerminalProjectViewComponent' },
}))

vi.mock('./TerminalTaskPane.svelte', () => ({
  default: mockTerminalTaskPane,
}))

vi.mock('./TerminalProjectView.svelte', () => ({
  default: mockTerminalProjectView,
}))

describe('terminal plugin', () => {
  it('does not retain stale host PluginContext state in the terminal plugin entry', () => {
    const indexSource = readFileSync(join(terminalSrcDir, 'index.ts'), 'utf8')

    expect(indexSource).not.toContain('./pluginContext')
    expect(indexSource).not.toContain('setPluginContext')
    expect(existsSync(join(terminalSrcDir, 'pluginContext.ts'))).toBe(false)
  })

  it('has a valid manifest with a top-level terminal view', () => {
    const errors = validatePluginManifest(manifest)
    expect(errors).toEqual([])
    expect(manifest.contributes.views).toEqual([
      {
        id: 'terminal',
        title: 'Terminal',
        icon: 'terminal',
        showInRail: true,
        railOrder: 40,
        shortcut: 'Cmd+J',
      },
    ])
  })

  it('activates top-level view, task pane, and background service implementations', async () => {
    const { activate } = await import('./index')
    const result = await activate({
      pluginId: 'test-plugin',
      invokeHost: async () => null,
      invokeBackend: async () => null,
      onEvent: () => () => {},
      storage: { get: async () => null, set: async () => {} },
    })
    expect(result.contributions.views).toHaveLength(1)
    expect(result.contributions.views?.[0]).toMatchObject({
      id: 'terminal',
      component: mockTerminalProjectView,
    })
    expect(result.contributions.taskPaneTabs).toHaveLength(1)
    expect(result.contributions.taskPaneTabs?.[0]).toMatchObject({
      id: 'terminal',
      component: mockTerminalTaskPane,
    })
    expect(result.contributions.backgroundServices).toHaveLength(1)
    expect(result.contributions.backgroundServices?.[0]?.id).toBe('pty-manager')
  })

  it('deactivates without error', async () => {
    const { deactivate } = await import('./index')
    await expect(deactivate()).resolves.toBeUndefined()
  })
})

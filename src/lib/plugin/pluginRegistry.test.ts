import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

const { installPluginMock, uninstallPluginIpcMock, getEnabledPluginsMock } = vi.hoisted(() => ({
  installPluginMock: vi.fn(),
  uninstallPluginIpcMock: vi.fn(),
  getEnabledPluginsMock: vi.fn(),
}))

vi.mock('../ipc', () => ({
  installPlugin: installPluginMock,
  uninstallPlugin: uninstallPluginIpcMock,
  getEnabledPlugins: getEnabledPluginsMock,
  listPlugins: vi.fn().mockResolvedValue([]),
  setPluginEnabled: vi.fn(),
}))

import {
  installPluginFromManifest,
  installPluginFromNpm,
  uninstallPlugin,
  loadEnabledForProject as registryLoadEnabledForProject,
} from './pluginRegistry'
import { installedPlugins, enabledPluginIds } from './pluginStore'
import type { PluginManifest } from './types'
import type { NormalizedPluginRow } from '../ipc'

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    apiVersion: 1,
    description: 'A test plugin',
    permissions: [],
    contributes: {},
    frontend: 'index.js',
    backend: null,
    ...overrides,
  }
}

function makeNormalized(id: string): NormalizedPluginRow {
  return {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    apiVersion: 1,
    description: 'Test',
    permissions: '[]',
    contributes: '{}',
    frontendEntry: 'index.js',
    backendEntry: null,
    installPath: '/tmp/plugin',
    installedAt: 0,
    isBuiltin: false,
  }
}

describe('pluginRegistry', () => {
  beforeEach(() => {
    installPluginMock.mockReset()
    uninstallPluginIpcMock.mockReset()
    getEnabledPluginsMock.mockReset()
    installedPlugins.set(new Map())
    enabledPluginIds.set(new Set())
  })

  it('installPluginFromManifest validates and installs', async () => {
    installPluginMock.mockResolvedValue(undefined)
    const manifest = makeManifest()
    await installPluginFromManifest(manifest, '/plugins/test-plugin')
    expect(installPluginMock).toHaveBeenCalledOnce()
    const call = installPluginMock.mock.calls[0][0]
    expect(call.id).toBe('test-plugin')
    expect(call.frontendEntry).toBe('index.js')
    const map = get(installedPlugins)
    expect(map.has('test-plugin')).toBe(true)
  })

  it('installPluginFromManifest rejects unsupported apiVersion', async () => {
    const manifest = makeManifest({ apiVersion: 999 })
    await expect(installPluginFromManifest(manifest, '/plugins/test')).rejects.toThrow(
      'Unsupported API version'
    )
    expect(installPluginMock).not.toHaveBeenCalled()
  })

  it('uninstallPlugin removes from store', async () => {
    uninstallPluginIpcMock.mockResolvedValue(undefined)
    installedPlugins.set(new Map([['test-plugin', { manifest: makeManifest(), state: 'installed', error: null }]]))
    await uninstallPlugin('test-plugin')
    expect(uninstallPluginIpcMock).toHaveBeenCalledWith('test-plugin')
    expect(get(installedPlugins).has('test-plugin')).toBe(false)
  })

  it('installPluginFromNpm throws not implemented', async () => {
    await expect(installPluginFromNpm('some-package')).rejects.toThrow('Not implemented: NPM install')
  })

  it('loadEnabledForProject populates enabled set', async () => {
    getEnabledPluginsMock.mockResolvedValue([makeNormalized('pa'), makeNormalized('pb')])
    await registryLoadEnabledForProject('proj1')
    const set = get(enabledPluginIds)
    expect(set.has('pa')).toBe(true)
    expect(set.has('pb')).toBe(true)
  })
})

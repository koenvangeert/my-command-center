import { writable, get } from 'svelte/store'
import type { PluginEntry } from './types'
import { listPlugins, setPluginEnabled, getEnabledPlugins } from '../ipc'

export const installedPlugins = writable<Map<string, PluginEntry>>(new Map())
export const enabledPluginIds = writable<Set<string>>(new Set())
export const loading = writable<boolean>(false)
export const error = writable<string | null>(null)

export async function loadInstalledPlugins(): Promise<void> {
  loading.set(true)
  error.set(null)
  try {
    const rows = await listPlugins()
    installedPlugins.set(new Map(rows.map(row => [
      row.id,
      {
        manifest: {
          id: row.id,
          name: row.name,
          version: row.version,
          apiVersion: row.apiVersion,
          description: row.description,
          permissions: JSON.parse(row.permissions),
          contributes: JSON.parse(row.contributes),
          frontend: row.frontendEntry,
          backend: row.backendEntry,
        },
        state: 'installed' as const,
        error: null,
      },
    ])))
  } catch (e) {
    error.set(e instanceof Error ? e.message : String(e))
  } finally {
    loading.set(false)
  }
}

export async function enablePlugin(projectId: string, pluginId: string): Promise<void> {
  await setPluginEnabled(projectId, pluginId, true)
  enabledPluginIds.update(set => {
    const next = new Set(set)
    next.add(pluginId)
    return next
  })
}

export async function disablePlugin(projectId: string, pluginId: string): Promise<void> {
  await setPluginEnabled(projectId, pluginId, false)
  enabledPluginIds.update(set => {
    const next = new Set(set)
    next.delete(pluginId)
    return next
  })
}

export function isPluginEnabled(pluginId: string): boolean {
  return get(enabledPluginIds).has(pluginId)
}

export function getContributions(_contributionType: string): unknown[] {
  return []
}

export async function loadEnabledForProject(projectId: string): Promise<void> {
  const rows = await getEnabledPlugins(projectId)
  enabledPluginIds.set(new Set(rows.map(r => r.id)))
}

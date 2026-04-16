import type { PluginManifest } from './types'
import { MAX_SUPPORTED_API_VERSION } from './types'
import { installPlugin, uninstallPlugin as uninstallPluginIpc, getEnabledPlugins } from '../ipc'
import { installedPlugins, enabledPluginIds } from './pluginStore'

export async function installPluginFromNpm(_packageName: string): Promise<void> {
  throw new Error('Not implemented: NPM install')
}

export async function installPluginFromManifest(manifest: PluginManifest, installPath: string): Promise<void> {
  if (manifest.apiVersion > MAX_SUPPORTED_API_VERSION) {
    throw new Error(`Unsupported API version: ${manifest.apiVersion}`)
  }

  await installPlugin({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    description: manifest.description,
    permissions: JSON.stringify(manifest.permissions),
    contributes: JSON.stringify(manifest.contributes),
    frontendEntry: manifest.frontend,
    backendEntry: manifest.backend,
    installPath,
    installedAt: Date.now(),
    isBuiltin: false,
  })

  installedPlugins.update(map => {
    const next = new Map(map)
    next.set(manifest.id, { manifest, state: 'installed', error: null })
    return next
  })
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  await uninstallPluginIpc(pluginId)
  installedPlugins.update(map => {
    const next = new Map(map)
    next.delete(pluginId)
    return next
  })
}

export async function loadEnabledForProject(projectId: string): Promise<void> {
  const rows = await getEnabledPlugins(projectId)
  enabledPluginIds.set(new Set(rows.map(r => r.id)))
}

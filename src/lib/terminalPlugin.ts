import manifestJson from '../../plugins/terminal/manifest.json'
import { makePluginViewKey } from './plugin/types'
import type { PluginManifest, PluginViewKey } from './plugin/types'

export const TERMINAL_PLUGIN_MANIFEST: PluginManifest = manifestJson
export const TERMINAL_PLUGIN_ID = TERMINAL_PLUGIN_MANIFEST.id
export const TERMINAL_VIEW_ID = 'terminal'
export const TERMINAL_VIEW_KEY: PluginViewKey = makePluginViewKey(TERMINAL_PLUGIN_ID, TERMINAL_VIEW_ID)

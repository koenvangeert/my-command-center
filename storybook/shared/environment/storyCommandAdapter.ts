import { applyRuntimeSnapshotContributions, clearPluginRuntimeContributions } from '../../../src/lib/plugin/pluginRuntimeContributions'
import type { RuntimeCommandContribution, RuntimeContributionSnapshot } from '../../../src/lib/plugin/runtimeContributionRegistry'
import type { StoryEnvironmentAdapter } from './storyEnvironment'

/** Register local handlers without activating packaged plugins or their runtime services. */
export function createStoryCommandAdapter(
  pluginId: string,
  commands: Array<Pick<RuntimeCommandContribution, 'id' | 'title' | 'handler' | 'discoverable'>>,
): StoryEnvironmentAdapter {
  let installed = false
  const snapshot: RuntimeContributionSnapshot = {
    pluginId, projectId: null,
    views: [], viewReplacements: [], taskPaneTabs: [], taskUISections: [], reviewRowActions: [],
    settingsSections: [], themes: [], injectionPoints: [], taskStartPrefixProviders: [],
    eventListeners: [], backendMethods: [], backgroundServices: [],
    commands: commands.map(command => ({ ...command, pluginId, projectId: null, qualifiedId: `${pluginId}:${command.id}` })),
  }
  return {
    async install() {
      if (installed) return
      installed = true
      await applyRuntimeSnapshotContributions(pluginId, snapshot)
    },
    async reset() {
      if (!installed) throw new Error('Story commands must be installed before reset')
      await applyRuntimeSnapshotContributions(pluginId, snapshot)
    },
    dispose() {
      if (!installed) return
      installed = false
      clearPluginRuntimeContributions(pluginId)
    },
  }
}

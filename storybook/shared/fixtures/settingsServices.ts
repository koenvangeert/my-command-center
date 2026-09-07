import type { StoryDesktopResponse } from '../environment/storyDesktopAdapter'
import type { StoryEnvironmentAdapter } from '../environment/storyEnvironment'
import type { TaskLabel } from '../../../src/lib/types'
import { disabledGateway, runningGateway, whisperModels } from './settingsFixtures'

/** Mutable local services. Every installation and reset starts from the same data. */
export function createSettingsServices() {
  let labels: TaskLabel[] = []
  let models = structuredClone(whisperModels)
  let gateway = structuredClone(disabledGateway)

  function reset() {
    labels = [{ id: 1, projectId: 'project-1', name: 'accessibility' }]
    models = structuredClone(whisperModels)
    gateway = structuredClone(disabledGateway)
  }

  const responses: Record<string, StoryDesktopResponse> = {
    get_project_task_labels: () => labels,
    create_task_label: (payload: unknown) => {
      const { projectId, name } = payload as { projectId: string; name: string }
      const label = { id: Math.max(0, ...labels.map(label => label.id)) + 1, projectId, name }
      labels = [...labels, label]
      return label
    },
    delete_task_label: (payload: unknown) => {
      const { labelId } = payload as { labelId: number }
      labels = labels.filter(label => label.id !== labelId)
    },
    get_all_whisper_model_statuses: () => models,
    set_whisper_model: (payload: unknown) => {
      const { modelSize } = payload as { modelSize: string }
      models = models.map(model => ({ ...model, is_active: model.size === modelSize }))
    },
    get_companion_gateway_status: () => gateway,
    set_companion_gateway_enabled: (payload: unknown) => {
      const { enabled } = payload as { enabled: boolean }
      gateway = structuredClone(enabled ? runningGateway : disabledGateway)
      return gateway
    },
  }
  const adapter: StoryEnvironmentAdapter = { install: reset, reset, dispose: reset }
  return { responses, adapter }
}

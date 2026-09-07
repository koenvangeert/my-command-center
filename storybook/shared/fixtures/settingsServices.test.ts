import { afterEach, expect, it } from 'vitest'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { createSettingsServices } from './settingsServices'
import { createTaskLabel, getProjectTaskLabels, getAllWhisperModelStatuses, setWhisperModel, getCompanionGatewayStatus, setCompanionGatewayEnabled } from '../../../src/lib/ipc'

let dispose = () => {}
afterEach(() => dispose())

it('resets edited settings service data through the public desktop boundary', async () => {
  const services = createSettingsServices()
  const desktop = createStoryDesktopAdapter({ responses: services.responses })
  services.adapter.install()
  desktop.install()
  dispose = () => { desktop.dispose(); services.adapter.dispose() }
  await createTaskLabel('project-1', 'regression')
  expect((await getProjectTaskLabels('project-1')).map(label => label.name)).toEqual(['accessibility', 'regression'])
  await setWhisperModel('base')
  expect((await getAllWhisperModelStatuses()).find(model => model.is_active)?.size).toBe('base')
  await setCompanionGatewayEnabled(true)
  expect((await getCompanionGatewayStatus()).enabled).toBe(true)
  await services.adapter.reset()
  await desktop.reset()
  expect((await getProjectTaskLabels('project-1')).map(label => label.name)).toEqual(['accessibility'])
  expect((await getAllWhisperModelStatuses()).find(model => model.is_active)?.size).toBe('tiny')
  expect((await getCompanionGatewayStatus()).enabled).toBe(false)
})

import { describe, expect, it } from 'vitest'
import { createTaskSchedulesIpc } from '../../../plugins/task-schedules/src/lib/ipc'
import { createStoryEnvironment } from './storyEnvironment'
import { createStoryPluginAdapter } from './storyPluginAdapter'
import { createSchedule } from '../fixtures/scheduleFixtures'

const now = Date.UTC(2026, 0, 2, 9, 30)

describe('schedule catalog backend through production IPC', () => {
  it.each(['daily', 'weekly', 'monthly', 'custom'] as const)('saves a supported %s cadence with production validation', async preset => {
    const plugin = createStoryPluginAdapter({ schedules: { projects: {} } })
    const environment = createStoryEnvironment({ id: preset, now, adapters: [plugin] })
    await environment.install()
    try {
      const ipc = createTaskSchedulesIpc(plugin.api)
      const saved = await ipc.save('project-1', { title: 'Review', prompt: 'Review release', preset, cron: '0 10 * * 1', timeOfDay: '10:00', dayOfWeek: 1 })
      expect(saved.timing).toMatchObject({ type: 'recurring', preset })
      const detached = await ipc.list('project-1')
      detached[0].title = 'Must not change the backend'
      expect((await ipc.list('project-1'))[0].title).toBe('Review')
      await expect(ipc.save('project-1', { title: '', prompt: 'Review' })).rejects.toThrow('title is required')
      await expect(ipc.save('project-1', { title: 'Past', prompt: 'Review', kind: 'once', runAt: now })).rejects.toThrow('future')
      await expect(ipc.save('project-1', { title: 'Invalid', prompt: 'Review', preset: 'custom', cron: 'nope' })).rejects.toThrow()
      expect(await ipc.list('project-1')).toHaveLength(1)
    } finally { await environment.dispose() }
  })

  it.each(['started', 'created', 'skipped', 'failed', 'cancelled'] as const)('records a simulated %s outcome without creating or starting a Task', async runOutcome => {
    const plugin = createStoryPluginAdapter({ schedules: { projects: { 'project-1': [createSchedule({ timing: { type: 'once', runAt: now + 60_000 } })] }, runOutcome } })
    const environment = createStoryEnvironment({ id: runOutcome, now, adapters: [plugin] })
    await environment.install()
    try {
      const ipc = createTaskSchedulesIpc(plugin.api)
      const outcome = await ipc.runNow('project-1', 'schedule-1')
      expect(outcome).toMatchObject({ status: runOutcome, firedAt: now, trigger: 'manual' })
      const saved = (await ipc.list('project-1'))[0]
      expect(saved.history).toEqual([outcome])
      expect(saved.lifecycle.state).toBe(['started', 'created'].includes(runOutcome) ? 'completed' : 'active')
      if (saved.lifecycle.state === 'completed') await expect(ipc.runNow('project-1', saved.id)).rejects.toThrow('cannot be run')
      expect(plugin.calls.taskCreations).toEqual([])
      expect(plugin.calls.taskImplementationStarts).toEqual([])
    } finally { await environment.dispose() }
  })

  it('simulates run outcomes locally and cancels pending runs, disposing held mutations on reset', async () => {
    const plugin = createStoryPluginAdapter({ schedules: { projects: { 'project-1': [createSchedule()] }, deferred: ['runNow', 'saveSchedule'] } })
    await plugin.install()
    try {
      const ipc = createTaskSchedulesIpc(plugin.api)
      const run = ipc.runNow('project-1', 'schedule-1')
      await expect(ipc.runNow('project-1', 'schedule-1')).rejects.toThrow('already running')
      await expect(ipc.cancelRunNow('project-1', 'schedule-1')).resolves.toEqual({ cancelled: true })
      await expect(run).resolves.toMatchObject({ status: 'cancelled', taskId: undefined })
      expect((await ipc.list('project-1'))[0].history).toHaveLength(1)
      const staleSave = ipc.save('project-1', { title: 'Must not persist', prompt: 'Discard me' })
      const rejection = expect(staleSave).rejects.toThrow('Story schedule backend disposed')
      await plugin.reset()
      await rejection
      expect(await createTaskSchedulesIpc(plugin.api).list('project-1')).toEqual([createSchedule()])
      expect(plugin.calls.taskCreations).toEqual([])
      expect(plugin.calls.taskImplementationStarts).toEqual([])
    } finally { await plugin.dispose() }
  })

  it('isolates create, edit, pause, enable and delete, then resets data and fixed time', async () => {
    const plugin = createStoryPluginAdapter({ schedules: { projects: { 'project-1': [createSchedule()] } } })
    const environment = createStoryEnvironment({ id: 'schedules', now, adapters: [plugin] })
    await environment.install()
    try {
      const ipc = createTaskSchedulesIpc(plugin.api)
      const saved = await ipc.save('project-1', { title: 'One-off review', prompt: 'Review release', kind: 'once', runAt: now + 3_600_000, mode: 'create-only' })
      expect(saved).toMatchObject({ id: 'catalog-schedule-1', createdAt: now, timing: { type: 'once', runAt: now + 3_600_000 } })
      await ipc.save('project-1', { id: saved.id, title: 'Edited review', prompt: 'Review release', enabled: false })
      expect(await ipc.list('project-1')).toHaveLength(2)
      expect((await ipc.list('project-1'))[1]).toMatchObject({ title: 'Edited review', lifecycle: { enabled: false } })
      await ipc.save('project-1', { id: saved.id, title: 'Edited review', prompt: 'Review release', enabled: true })
      expect((await ipc.list('project-1'))[1].lifecycle).toMatchObject({ enabled: true })
      await ipc.delete('project-1', 'schedule-1')
      expect(await ipc.list('project-1')).toHaveLength(1)
      expect(await ipc.list('another-project')).toEqual([])
      await environment.reset()
      const resetIpc = createTaskSchedulesIpc(plugin.api)
      expect(await resetIpc.list('project-1')).toEqual([createSchedule()])
      expect(Date.now()).toBe(now)
      expect(plugin.calls.taskCreations).toEqual([])
      expect(plugin.calls.taskImplementationStarts).toEqual([])
    } finally { await environment.dispose() }
    expect(Date.now()).not.toBe(now)
  })
})

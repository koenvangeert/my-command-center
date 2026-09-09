import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryPluginAdapter } from '../environment/storyPluginAdapter'
import { createStoryStorageAdapter } from '../environment/storyStorageAdapter'
import { scheduleScenario, scheduleProject, scheduleNow } from '../fixtures/scheduleScenario'
import { createTaskSchedulesIpc } from '../../../plugins/task-schedules/src/lib/ipc'
import TaskSchedulesPage from './TaskSchedulesPage.svelte'

afterEach(cleanup)
describe('Task Schedules catalog production UI', () => {
  it('creates and edits local schedules and restores layout, data and timers on remount', async () => {
    const scenario = scheduleScenario()
    const plugin = createStoryPluginAdapter(scenario.plugin)
    const environment = createStoryEnvironment({ id: 'schedule-page', now: scheduleNow, adapters: [
      createStoryStorageAdapter(localStorage), plugin, ...scenario.adapters!(),
    ] })
    const intervals = vi.spyOn(window, 'setInterval')
    const clear = vi.spyOn(window, 'clearInterval')
    await environment.install()
    try {
      const mount = () => render(TaskSchedulesPage, { props: { api: plugin.api, context: plugin.context } })
      let view = mount()
      await screen.findByRole('button', { name: 'Daily dependency triage' })
      await fireEvent.click(screen.getByRole('button', { name: 'New Task Schedule' }))
      const form = within(screen.getByRole('complementary', { name: 'Task Schedule form' }))
      await fireEvent.input(form.getByLabelText('Title (required)'), { target: { value: 'Catalog review' } })
      await fireEvent.input(form.getByLabelText('Prompt (required)'), { target: { value: 'Review safely' } })
      await fireEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
      await screen.findByRole('heading', { name: 'Catalog review' })
      const ipc = createTaskSchedulesIpc(plugin.api)
      expect((await ipc.list(scheduleProject.id)).at(-1)).toMatchObject({ title: 'Catalog review', prompt: 'Review safely' })
      await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      await fireEvent.input(screen.getByLabelText('Title (required)'), { target: { value: 'Edited catalog review' } })
      await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      await screen.findByRole('heading', { name: 'Edited catalog review' })
      expect(plugin.calls.taskCreations).toEqual([])
      expect(plugin.calls.taskImplementationStarts).toEqual([])
      localStorage.setItem('resizable-panel:task-schedules-inspector', '610')
      const timer = intervals.mock.results.find((_, index) => intervals.mock.calls[index][1] === 30_000)?.value
      expect(timer).toBeDefined()
      view.unmount()
      expect(clear).toHaveBeenCalledWith(timer)
      await environment.reset()
      view = mount()
      await screen.findByRole('button', { name: 'Daily dependency triage' })
      await waitFor(() => expect(screen.queryByText('Edited catalog review')).toBeNull())
      expect(await createTaskSchedulesIpc(plugin.api).list(scheduleProject.id)).toHaveLength(7)
      expect(localStorage.getItem('resizable-panel:task-schedules-inspector')).toBeNull()
      expect(Date.now()).toBe(scheduleNow)
      view.unmount()
    } finally { cleanup(); await environment.dispose(); intervals.mockRestore(); clear.mockRestore() }
  }, 15_000)
})

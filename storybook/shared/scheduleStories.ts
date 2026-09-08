import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import { createTaskSchedulesIpc } from '../../plugins/task-schedules/src/lib/ipc'
import { getStoryScenario } from './storyEnvironmentPreview'
import { scheduleNow, scheduleProject } from './fixtures/scheduleScenario'

export interface SchedulePlayContext {
  id: string
  canvasElement: HTMLElement
  loaded: Record<string, unknown>
}
export const scheduleQueries = (context: SchedulePlayContext) => within(context.canvasElement.ownerDocument.body)
export const scheduleIpc = (context: SchedulePlayContext) => createTaskSchedulesIpc(getStoryScenario(context).plugin.api)

export function schedulePlay(action: (context: SchedulePlayContext) => Promise<unknown>) {
  return async (context: SchedulePlayContext) => {
    await action(context)
    const { plugin } = getStoryScenario(context)
    await expect(plugin.calls.taskCreations).toEqual([])
    await expect(plugin.calls.taskImplementationStarts).toEqual([])
    await expect(Date.now()).toBe(scheduleNow)
    context.canvasElement.dataset.scheduleReady = context.id
  }
}

export async function clickScheduleButton(button: HTMLElement) {
  // Modal teardown releases its pointer lock after the outgoing transition.
  await waitFor(() => expect(getComputedStyle(button).pointerEvents).not.toBe('none'))
  await userEvent.click(button)
}

export async function selectSchedule(context: SchedulePlayContext, title = 'Daily dependency triage') {
  const body = scheduleQueries(context)
  await clickScheduleButton(await body.findByRole('button', { name: title }))
  return within(await body.findByRole('complementary', { name: 'Task Schedule details' }))
}

export async function openScheduleForm(context: SchedulePlayContext) {
  const body = scheduleQueries(context)
  await body.findByRole('table', { name: 'Task Schedules' })
  await clickScheduleButton(body.getByRole('button', { name: 'New Task Schedule' }))
  return within(await body.findByRole('complementary', { name: 'Task Schedule form' }))
}

export async function fillSchedule(context: SchedulePlayContext, title = 'Catalog release review') {
  const form = within(await scheduleQueries(context).findByRole('complementary', { name: 'Task Schedule form' }))
  await userEvent.clear(form.getByLabelText('Title (required)'))
  await userEvent.type(form.getByLabelText('Title (required)'), title)
  await userEvent.clear(form.getByLabelText('Prompt (required)'))
  await userEvent.type(form.getByLabelText('Prompt (required)'), 'Review release readiness without starting real work.')
  return form
}

export async function chooseScheduleOption(context: SchedulePlayContext, label: string, option: string) {
  const body = scheduleQueries(context)
  await userEvent.click(body.getByLabelText(label, { exact: true }))
  await userEvent.click(await body.findByRole('option', { name: option }))
}

export async function createScheduleAndVerify(context: SchedulePlayContext, kind: 'daily' | 'weekly' | 'monthly' | 'custom' | 'once') {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  if (kind === 'once') {
    await userEvent.click(form.getByRole('radio', { name: /One time/ }))
    await fireEvent.input(form.getByLabelText('Run on (required)'), { target: { value: '2026-01-03T10:30' } })
  } else if (kind === 'custom') {
    await userEvent.click(form.getByRole('checkbox'))
    await userEvent.clear(form.getByLabelText('Cron expression'))
    await userEvent.type(form.getByLabelText('Cron expression'), '0 10 * * 1-5')
  } else if (kind !== 'daily') {
    await chooseScheduleOption(context, 'Frequency', kind === 'weekly' ? 'Weekly' : 'Monthly')
  }
  await chooseScheduleOption(context, 'Mode', 'Create only')
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await scheduleQueries(context).findByRole('heading', { name: 'Catalog release review' })
  const saved = (await scheduleIpc(context).list(scheduleProject.id)).find(schedule => schedule.title === 'Catalog release review')
  await expect(saved).toMatchObject({ mode: 'create-only', timing: kind === 'once' ? { type: 'once' } : { type: 'recurring', preset: kind } })
}

export async function runAndVerify(context: SchedulePlayContext, label: string) {
  const body = scheduleQueries(context)
  await userEvent.click(await body.findByRole('button', { name: 'Run now' }))
  await expect(body.findByText(label, { exact: true })).resolves.toBeVisible()
}

export async function confirmDelete(context: SchedulePlayContext) {
  const body = scheduleQueries(context)
  await userEvent.click(body.getByRole('button', { name: 'Delete Task Schedule' }))
  return within(await body.findByRole('dialog', { name: 'Delete Task Schedule confirmation' }))
}

export async function verifyDeleted(context: SchedulePlayContext) {
  const dialog = await confirmDelete(context)
  await userEvent.click(dialog.getByRole('button', { name: 'Delete Task Schedule' }))
  await waitFor(() => expect(scheduleQueries(context).queryByRole('button', { name: 'Daily dependency triage' })).not.toBeInTheDocument())
  await expect((await scheduleIpc(context).list(scheduleProject.id)).some(schedule => schedule.id === 'schedule-1')).toBe(false)
}

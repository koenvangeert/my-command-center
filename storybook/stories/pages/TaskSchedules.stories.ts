import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, waitFor } from 'storybook/test'
import TaskSchedulesPage from '../../shared/frames/TaskSchedulesPage.svelte'
import { scheduleScenario, scheduleProject } from '../../shared/fixtures/scheduleScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'
import { schedulePlay, clickScheduleButton, scheduleQueries, scheduleIpc, selectSchedule, openScheduleForm, fillSchedule, createScheduleAndVerify, runAndVerify, confirmDelete, verifyDeleted } from '../../shared/scheduleStories'

const meta = {
  title: 'Pages/Task Schedules', component: TaskSchedulesPage,
  parameters: { openforge: scheduleScenario() },
  beforeEach: context => { delete context.canvasElement.dataset.scheduleReady },
  render: (args, context) => {
    const { plugin } = getStoryScenario(context)
    return { Component: TaskSchedulesPage, props: { ...args, api: plugin.api, context: plugin.context } }
  },
  play: schedulePlay(async context => { await scheduleQueries(context).findByRole('table', { name: 'Task Schedules' }) }),
} satisfies Meta<typeof TaskSchedulesPage>
export default meta
type Story = StoryObj<{ noProject?: boolean }>

export const Populated: Story = {}
export const Empty: Story = { parameters: { openforge: scheduleScenario('empty') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('No Task Schedules found') }) }
export const Loading: Story = { parameters: { openforge: scheduleScenario('loading') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('Loading Task Schedules') }) }
export const Failure: Story = { parameters: { openforge: scheduleScenario('failure') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('Task Schedules are unavailable.') }) }
export const NoProject: Story = { args: { noProject: true }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('Select a project to manage Task Schedules.') }) }
export const Narrow: Story = { globals: { viewport: { value: 'narrow', isRotated: false } } }
export const LongContent: Story = { parameters: { openforge: scheduleScenario('long') }, play: schedulePlay(async context => { await selectSchedule(context, 'Daily dependency triage for the platform accessibility and release-readiness working group') }) }
export const Details: Story = { play: schedulePlay(async context => { await selectSchedule(context) }) }
export const History: Story = { parameters: { openforge: scheduleScenario('history') }, play: schedulePlay(async context => {
  const details = await selectSchedule(context)
  await expect(details.getAllByRole('listitem')).toHaveLength(5)
  await userEvent.click(details.getByRole('button', { name: 'CATALOG-1' }))
  await expect(getStoryScenario(context).plugin.calls.navigationRequests).toEqual([{ projectId: scheduleProject.id, taskId: 'CATALOG-1' }])
}) }
export const Completed: Story = { play: schedulePlay(async context => { const details = await selectSchedule(context, 'Completed release review'); await expect(details.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument() }) }
export const Cancelled: Story = { play: schedulePlay(async context => { const details = await selectSchedule(context, 'Cancelled release review'); await expect(details.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument() }) }
export const NewSchedule: Story = { play: schedulePlay(async context => { await openScheduleForm(context) }) }
export const CreateDaily: Story = { play: schedulePlay(context => createScheduleAndVerify(context, 'daily')) }
export const CreateWeekly: Story = { play: schedulePlay(context => createScheduleAndVerify(context, 'weekly')) }
export const CreateMonthly: Story = { play: schedulePlay(context => createScheduleAndVerify(context, 'monthly')) }
export const CreateCustom: Story = { play: schedulePlay(context => createScheduleAndVerify(context, 'custom')) }
export const CreateOneOff: Story = { play: schedulePlay(context => createScheduleAndVerify(context, 'once')) }
export const Edit: Story = { play: schedulePlay(async context => {
  const details = await selectSchedule(context)
  await userEvent.click(details.getByRole('button', { name: 'Edit' }))
  const form = await fillSchedule(context, 'Edited dependency triage')
  await userEvent.click(form.getByRole('button', { name: 'Save changes' }))
  await scheduleQueries(context).findByRole('heading', { name: 'Edited dependency triage' })
  await expect((await scheduleIpc(context).list(scheduleProject.id)).find(schedule => schedule.id === 'schedule-1')?.title).toBe('Edited dependency triage')
}) }
export const PauseAndEnable: Story = { play: schedulePlay(async context => {
  const details = await selectSchedule(context)
  for (let repeat = 0; repeat < 2; repeat++) {
    await userEvent.click(details.getByRole('button', { name: 'Pause' }))
    await userEvent.click(await details.findByRole('button', { name: 'Enable' }))
    await details.findByRole('button', { name: 'Pause' })
  }
  await expect((await scheduleIpc(context).list(scheduleProject.id))[0].lifecycle).toMatchObject({ enabled: true })
}) }
export const FilterAndSort: Story = { play: schedulePlay(async context => {
  const body = scheduleQueries(context)
  await body.findByRole('table', { name: 'Task Schedules' })
  await userEvent.click(body.getByRole('button', { name: 'Paused Task Schedules' }))
  await body.findByRole('button', { name: 'Weekly backlog review' })
  await expect(body.queryByRole('button', { name: 'Daily dependency triage' })).not.toBeInTheDocument()
  await userEvent.click(body.getByRole('button', { name: 'All Task Schedules' }))
  await userEvent.click(body.getByRole('button', { name: 'Sort by Task Schedule' }))
  await expect(body.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending')
  await userEvent.click(body.getByRole('button', { name: 'Sort by Task Schedule' }))
  await expect(body.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'descending')
}) }
export const Retry: Story = { parameters: { openforge: scheduleScenario('failure') }, play: schedulePlay(async context => {
  const body = scheduleQueries(context)
  await body.findByText('Task Schedules are unavailable.')
  getStoryScenario(context).plugin.schedules!.release('listSchedules')
  await userEvent.click(body.getByRole('button', { name: 'Retry' }))
  await body.findByRole('table', { name: 'Task Schedules' })
}) }
export const FinishLoading: Story = { parameters: { openforge: scheduleScenario('loading') }, play: schedulePlay(async context => {
  await scheduleQueries(context).findByText('Loading Task Schedules')
  getStoryScenario(context).plugin.schedules!.release('listSchedules')
  await scheduleQueries(context).findByRole('table', { name: 'Task Schedules' })
}) }
export const SaveFailure: Story = { parameters: { openforge: scheduleScenario('save-failure') }, play: schedulePlay(async context => {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await scheduleQueries(context).findByText('Task Schedules could not be saved.')
}) }
export const Saving: Story = { parameters: { openforge: scheduleScenario('saving') }, play: schedulePlay(async context => {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await expect(form.findByRole('button', { name: 'Saving…' })).resolves.toBeDisabled()
}) }
export const Discard: Story = { play: schedulePlay(async context => {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  await clickScheduleButton(form.getByRole('button', { name: 'Cancel' }))
  await scheduleQueries(context).findByRole('dialog', { name: 'Discard Task Schedule changes' })
}) }
export const DiscardAndReopen: Story = { play: schedulePlay(async context => {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  await clickScheduleButton(form.getByRole('button', { name: 'Cancel' }))
  const body = scheduleQueries(context)
  await userEvent.click(await body.findByRole('button', { name: 'Keep editing' }))
  await expect(form.getByLabelText('Title (required)')).toHaveValue('Catalog release review')
  await clickScheduleButton(form.getByRole('button', { name: 'Cancel' }))
  await userEvent.click(await body.findByRole('button', { name: 'Discard changes' }))
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(getComputedStyle(body.getByRole('button', { name: 'New Task Schedule' })).pointerEvents).not.toBe('none'))
  const fresh = await openScheduleForm(context)
  await expect(fresh.getByLabelText('Title (required)')).toHaveValue('')
}) }
export const DeleteConfirmation: Story = { play: schedulePlay(async context => { await selectSchedule(context); await confirmDelete(context) }) }
export const Delete: Story = { play: schedulePlay(async context => { await selectSchedule(context); await verifyDeleted(context) }) }
export const DeleteFailure: Story = { parameters: { openforge: scheduleScenario('delete-failure') }, play: schedulePlay(async context => {
  await selectSchedule(context)
  const dialog = await confirmDelete(context)
  await userEvent.click(dialog.getByRole('button', { name: 'Delete Task Schedule' }))
  await scheduleQueries(context).findByText('Task Schedule could not be deleted.')
}) }
export const RunNow: Story = { play: schedulePlay(async context => { await selectSchedule(context); await runAndVerify(context, 'Run completed') }) }
export const RunOneOff: Story = { play: schedulePlay(async context => {
  const details = await selectSchedule(context, 'One-off release review')
  await runAndVerify(context, 'Run completed')
  await expect(details.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument()
  await expect((await scheduleIpc(context).list(scheduleProject.id)).find(schedule => schedule.id === 'once')?.lifecycle.state).toBe('completed')
}) }
export const Running: Story = { parameters: { openforge: scheduleScenario('running') }, play: schedulePlay(async context => { await selectSchedule(context); await runAndVerify(context, 'Running now…') }) }
export const CancelRun: Story = { parameters: { openforge: scheduleScenario('running') }, play: schedulePlay(async context => {
  await selectSchedule(context)
  await runAndVerify(context, 'Running now…')
  await userEvent.click(scheduleQueries(context).getByRole('button', { name: 'Cancel run' }))
  await scheduleQueries(context).findByText('Run cancelled', { exact: true })
}) }
export const Cancelling: Story = { parameters: { openforge: scheduleScenario('cancelling') }, play: schedulePlay(async context => {
  await selectSchedule(context)
  await runAndVerify(context, 'Running now…')
  await userEvent.click(scheduleQueries(context).getByRole('button', { name: 'Cancel run' }))
  await scheduleQueries(context).findByText('Cancelling…', { exact: true })
}) }
export const RunFailure: Story = { parameters: { openforge: scheduleScenario('run-failure') }, play: schedulePlay(async context => { await selectSchedule(context); await runAndVerify(context, 'Run failed') }) }
export const RunWarning: Story = { parameters: { openforge: scheduleScenario('warning') }, play: schedulePlay(async context => { await selectSchedule(context); await runAndVerify(context, 'Run completed with a warning') }) }
export const AlreadyRunning: Story = { parameters: { openforge: scheduleScenario('already-running') }, play: schedulePlay(async context => { await selectSchedule(context); await runAndVerify(context, 'Already running') }) }

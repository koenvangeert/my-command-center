import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, userEvent, fireEvent, within } from 'storybook/test'
import TaskSchedulesModule from '../../shared/frames/TaskSchedulesModule.svelte'
import { scheduleScenario } from '../../shared/fixtures/scheduleScenario'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'
import { schedulePlay, scheduleQueries, selectSchedule, openScheduleForm, fillSchedule, chooseScheduleOption, confirmDelete, runAndVerify } from '../../shared/scheduleStories'

const meta = {
  title: 'Components/Task Schedules', component: TaskSchedulesModule,
  parameters: { openforge: scheduleScenario() },
  beforeEach: context => { delete context.canvasElement.dataset.scheduleReady },
  render: (args, context) => ({ Component: TaskSchedulesModule, props: { ...args, api: getStoryScenario(context).plugin.api } }),
  play: schedulePlay(async context => { await scheduleQueries(context).findByRole('table', { name: 'Task Schedules' }) }),
} satisfies Meta<typeof TaskSchedulesModule>
export default meta
type Story = StoryObj<{ module?: 'workspace' | 'list' | 'inspector' | 'composer' | 'dialogs'; scheduleId?: string; edit?: boolean }>
const composerReady = schedulePlay(async context => { await scheduleQueries(context).findByRole('complementary', { name: 'Task Schedule form' }) })
const inspectorReady = schedulePlay(async context => { await scheduleQueries(context).findByRole('complementary', { name: 'Task Schedule details' }) })

export const Workspace: Story = {}
export const WorkspaceFailure: Story = { parameters: { openforge: scheduleScenario('failure') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('Task Schedules are unavailable.') }) }
export const List: Story = { args: { module: 'list' } }
export const ListEmpty: Story = { args: { module: 'list' }, parameters: { openforge: scheduleScenario('empty') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('No Task Schedules found') }) }
export const ListLoading: Story = { args: { module: 'list' }, parameters: { openforge: scheduleScenario('loading') }, play: schedulePlay(async context => { await scheduleQueries(context).findByText('Loading Task Schedules') }) }
export const ListNarrow: Story = { args: { module: 'list' }, globals: { viewport: { value: 'narrow', isRotated: false } } }
export const ListLong: Story = { args: { module: 'list' }, parameters: { openforge: scheduleScenario('long') } }
export const ListSelected: Story = { args: { module: 'list' }, play: schedulePlay(async context => {
  const body = scheduleQueries(context)
  const row = await body.findByRole('row', { name: 'Select Weekly backlog review' })
  row.focus()
  await userEvent.keyboard('{Enter}')
  await expect(row).toHaveAttribute('aria-selected', 'true')
}) }
export const Inspector: Story = { args: { module: 'inspector' }, play: inspectorReady }
export const InspectorPaused: Story = { args: { module: 'inspector', scheduleId: 'weekly' }, play: inspectorReady }
export const InspectorCompleted: Story = { args: { module: 'inspector', scheduleId: 'completed' }, play: inspectorReady }
export const InspectorCancelled: Story = { args: { module: 'inspector', scheduleId: 'cancelled' }, play: inspectorReady }
export const InspectorHistory: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('history') }, play: inspectorReady }
export const InspectorLong: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('long') }, play: inspectorReady }
export const InspectorUpdating: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('saving') }, play: schedulePlay(async context => {
  await userEvent.click(await scheduleQueries(context).findByRole('button', { name: 'Pause' }))
  await expect(scheduleQueries(context).findByRole('button', { name: 'Updating…' })).resolves.toBeDisabled()
}) }
export const InspectorRunning: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('running') }, play: schedulePlay(context => runAndVerify(context, 'Running now…')) }
export const InspectorSuccess: Story = { args: { module: 'inspector' }, play: schedulePlay(context => runAndVerify(context, 'Run completed')) }
export const InspectorWarning: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('warning') }, play: schedulePlay(context => runAndVerify(context, 'Run completed with a warning')) }
export const InspectorFailure: Story = { args: { module: 'inspector' }, parameters: { openforge: scheduleScenario('run-failure') }, play: schedulePlay(context => runAndVerify(context, 'Run failed')) }
export const Composer: Story = { args: { module: 'composer' }, play: composerReady }
export const ComposerWeekly: Story = { args: { module: 'composer', scheduleId: 'weekly', edit: true }, play: composerReady }
export const ComposerMonthly: Story = { args: { module: 'composer', scheduleId: 'monthly', edit: true }, play: composerReady }
export const ComposerCustom: Story = { args: { module: 'composer', scheduleId: 'custom', edit: true }, play: composerReady }
export const ComposerOneOff: Story = { args: { module: 'composer', scheduleId: 'once', edit: true }, play: composerReady }
export const ComposerNarrow: Story = { args: { module: 'composer' }, globals: { viewport: { value: 'narrow', isRotated: false } }, play: composerReady }
export const ComposerLong: Story = { args: { module: 'composer', edit: true }, parameters: { openforge: scheduleScenario('long') }, play: composerReady }
export const ComposerMode: Story = { args: { module: 'composer' }, play: schedulePlay(async context => {
  await scheduleQueries(context).findByRole('complementary', { name: 'Task Schedule form' })
  await chooseScheduleOption(context, 'Mode', 'Create only')
  await userEvent.click(scheduleQueries(context).getByRole('switch'))
  await expect(scheduleQueries(context).getByRole('switch')).not.toBeChecked()
}) }
export const ComposerRequired: Story = { args: { module: 'composer' }, play: schedulePlay(async context => {
  const form = within(await scheduleQueries(context).findByRole('complementary', { name: 'Task Schedule form' }))
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await expect(form.getByLabelText('Title (required)')).toBeInvalid()
  await expect(form.getByLabelText('Prompt (required)')).toBeInvalid()
  await expect(getStoryScenario(context).plugin.calls.backendInvocations.filter(call => call.method === 'saveSchedule')).toEqual([])
}) }
export const ComposerCronValidation: Story = { args: { module: 'composer' }, play: schedulePlay(async context => {
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('checkbox'))
  await userEvent.clear(form.getByLabelText('Cron expression'))
  await userEvent.type(form.getByLabelText('Cron expression'), 'invalid cron')
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await expect(form.getByLabelText('Cron expression')).toHaveAttribute('aria-invalid', 'true')
  await expect(getStoryScenario(context).plugin.calls.backendInvocations.filter(call => call.method === 'saveSchedule')).toEqual([])
}) }
export const ComposerDateValidation: Story = { args: { module: 'composer' }, play: schedulePlay(async context => {
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('radio', { name: /One time/ }))
  await fireEvent.input(form.getByLabelText('Run on (required)'), { target: { value: '2026-01-01T10:00' } })
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await expect(form.findByText('Choose a date and time in the future.')).resolves.toBeVisible()
}) }
export const ComposerSaving: Story = { args: { module: 'composer' }, parameters: { openforge: scheduleScenario('saving') }, play: schedulePlay(async context => {
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('button', { name: 'Create Task Schedule' }))
  await expect(form.findByRole('button', { name: 'Saving…' })).resolves.toBeDisabled()
}) }
export const DiscardDialog: Story = { args: { module: 'dialogs' }, play: schedulePlay(async context => {
  await openScheduleForm(context)
  const form = await fillSchedule(context)
  await userEvent.click(form.getByRole('button', { name: 'Cancel' }))
  await scheduleQueries(context).findByRole('dialog', { name: 'Discard Task Schedule changes' })
}) }
export const DeleteDialog: Story = { args: { module: 'dialogs' }, play: schedulePlay(async context => { await selectSchedule(context); await confirmDelete(context) }) }
export const DeletingDialog: Story = { args: { module: 'dialogs' }, parameters: { openforge: scheduleScenario('deleting') }, play: schedulePlay(async context => {
  await selectSchedule(context)
  const dialog = await confirmDelete(context)
  await userEvent.click(dialog.getByRole('button', { name: 'Delete Task Schedule' }))
  await expect(dialog.findByRole('button', { name: 'Deleting…' })).resolves.toBeDisabled()
}) }

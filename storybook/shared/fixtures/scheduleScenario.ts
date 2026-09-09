import { activeProjectId, projects } from '../../../src/lib/stores'
import type { ScheduledFireOutcome, TaskSchedule } from '../../../plugins/task-schedules/src/lib/types'
import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import type { StoryScheduleDefinition } from '../environment/storyScheduleBackend'
import { createStoryStoreAdapter as seed } from '../environment/storyStoreAdapter'
import { createProject } from './appFixtures'
import { createSchedule } from './scheduleFixtures'

export const scheduleProject = createProject()
export const scheduleView = 'plugin:com.openforge.task-schedules:schedules' as const
export const scheduleNow = Date.UTC(2026, 0, 2, 9, 30)
export type ScheduleScenario = 'populated' | 'empty' | 'loading' | 'failure' | 'history' | 'long' | 'save-failure' | 'saving' | 'deleting' | 'delete-failure' | 'running' | 'cancelling' | 'run-failure' | 'warning' | 'already-running'

export function scheduleRecords(state: ScheduleScenario = 'populated'): TaskSchedule[] {
  if (state === 'empty') return []
  const history: ScheduledFireOutcome[] = (['started', 'created', 'skipped', 'failed', 'cancelled'] as const).map((status, index) => ({
    id: `history-${index}`, firedAt: scheduleNow - (5 - index) * 3_600_000, trigger: index % 2 ? 'manual' : 'scheduled', status,
    ...(['started', 'created'].includes(status) ? { taskId: `CATALOG-${index + 1}` } : {}),
    message: ['Created and started scheduled Task CATALOG-1', 'Created scheduled Task CATALOG-2', 'Skipped because the previous Task is still open', 'Provider is unavailable. Check credentials before retrying.', 'Run cancelled before creating a Task'][index],
  }))
  return [
    createSchedule({ history: state === 'history' || state === 'long' ? history : [], lifecycle: { state: 'active', enabled: true, nextFireAt: Date.UTC(2026, 0, 3, 9) },
      ...(state === 'long' ? { title: 'Daily dependency triage for the platform accessibility and release-readiness working group', prompt: 'Review the release notes, check dependency compatibility, and report accessibility regressions.\n'.repeat(14) } : {}),
    }),
    createSchedule({ id: 'weekly', title: 'Weekly backlog review', mode: 'create-only', timing: { type: 'recurring', preset: 'weekly', cron: '0 9 * * 1' }, lifecycle: { state: 'active', enabled: false, nextFireAt: Date.UTC(2026, 0, 5, 9) } }),
    createSchedule({ id: 'monthly', title: 'Monthly release audit', timing: { type: 'recurring', preset: 'monthly', cron: '0 9 1 * *' }, lifecycle: { state: 'active', enabled: true, nextFireAt: Date.UTC(2026, 1, 1, 9) }, history: [history[3]] }),
    createSchedule({ id: 'custom', title: 'Weekday dependency check', timing: { type: 'recurring', preset: 'custom', cron: '0 10 * * 1-5' }, lifecycle: { state: 'active', enabled: true, nextFireAt: Date.UTC(2026, 0, 2, 10) }, history: [history[2]] }),
    createSchedule({ id: 'once', title: 'One-off release review', mode: 'create-only', timing: { type: 'once', runAt: scheduleNow + 3_600_000 }, lifecycle: { state: 'active', enabled: true, nextFireAt: scheduleNow + 3_600_000 } }),
    createSchedule({ id: 'completed', title: 'Completed release review', timing: { type: 'once', runAt: scheduleNow - 3_600_000 }, lifecycle: { state: 'completed', completedAt: scheduleNow - 3_600_000 }, history: [history[1]] }),
    createSchedule({ id: 'cancelled', title: 'Cancelled release review', timing: { type: 'once', runAt: scheduleNow + 3_600_000 }, lifecycle: { state: 'cancelled', cancelledAt: scheduleNow - 60_000 }, history: [history[4]] }),
  ]
}

export function scheduleScenario(state: ScheduleScenario = 'populated'): StoryScenarioDefinition {
  const schedules: StoryScheduleDefinition = { projects: { [scheduleProject.id]: scheduleRecords(state) } }
  if (state === 'loading') schedules.deferred = ['listSchedules']
  if (state === 'saving') schedules.deferred = ['saveSchedule']
  if (state === 'deleting') schedules.deferred = ['deleteSchedule']
  if (state === 'running') schedules.deferred = ['runNow']
  if (state === 'cancelling') schedules.deferred = ['runNow', 'cancelRunNow']
  if (state === 'failure') schedules.failures = { listSchedules: 'Task Schedules are unavailable.' }
  if (state === 'save-failure') schedules.failures = { saveSchedule: 'Task Schedules could not be saved.' }
  if (state === 'delete-failure') schedules.failures = { deleteSchedule: 'Task Schedule could not be deleted.' }
  if (state === 'already-running') schedules.failures = { runNow: 'This Task Schedule is already running' }
  if (state === 'run-failure') schedules.runOutcome = 'failed'
  if (state === 'warning') schedules.runOutcome = 'skipped'
  return {
    now: scheduleNow,
    plugin: { pluginId: 'com.openforge.task-schedules', projectId: scheduleProject.id, schedules },
    adapters: () => [seed(projects, [scheduleProject]), seed(activeProjectId, scheduleProject.id)],
  }
}

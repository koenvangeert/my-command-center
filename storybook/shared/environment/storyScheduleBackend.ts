import type { BackendMethodRegistration } from '@openforge-app/plugin-sdk/backend'
import { normalizeScheduleDraft, completeOneOffSchedule } from '../../../plugins/task-schedules/src/backend/scheduleValidation'
import { requireScheduleIdRequest, requireSaveScheduleRequest, requireProjectRequest } from '../../../plugins/task-schedules/src/backend/requestParsing'
import type { ScheduledFireOutcome, ScheduledFireStatus, TaskSchedule } from '../../../plugins/task-schedules/src/lib/types'

export type ScheduleMethod = 'listSchedules' | 'saveSchedule' | 'deleteSchedule' | 'runNow' | 'cancelRunNow'
export interface StoryScheduleDefinition {
  projects: Readonly<Record<string, readonly TaskSchedule[]>>
  deferred?: readonly ScheduleMethod[]
  failures?: Partial<Record<ScheduleMethod, string>>
  runOutcome?: ScheduledFireStatus
}

/** Local records and simulated outcomes only. No Tasks API, polling service, or host backend. */
export function createStoryScheduleBackend(definition: StoryScheduleDefinition) {
  const projects = new Map(Object.entries(structuredClone(definition.projects)))
  const deferred = new Set(definition.deferred)
  const failures = new Map(Object.entries(definition.failures ?? {}))
  const pending = new Set<{ method: ScheduleMethod; resolve(): void; reject(error: Error): void }>()
  const runs = new Map<string, AbortController>()
  let sequence = 0
  let fireSequence = 0
  let disposed = false
  const list = (projectId: string) => [...(projects.get(projectId) ?? [])]

  async function wait(method: ScheduleMethod, signal?: AbortSignal) {
    if (disposed) throw new Error('Story schedule backend disposed')
    if (deferred.has(method) && !signal?.aborted) await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        pending.delete(request)
        signal?.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else resolve()
      }
      const onAbort = () => finish()
      const request = { method, resolve: onAbort, reject: finish }
      pending.add(request)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    if (disposed) throw new Error('Story schedule backend disposed')
    if (failures.has(method)) throw new Error(failures.get(method))
  }

  function find(projectId: string, scheduleId: string) {
    const schedule = list(projectId).find(candidate => candidate.id === scheduleId)
    if (!schedule) throw new Error('Task Schedule not found')
    return schedule
  }

  const methods: Record<ScheduleMethod, BackendMethodRegistration> = {
    listSchedules: { async handler(payload) {
      await wait('listSchedules')
      return structuredClone(list(requireProjectRequest(payload).projectId))
    } },
    saveSchedule: { async handler(payload) {
      await wait('saveSchedule')
      const { projectId, schedule: draft } = requireSaveScheduleRequest(payload)
      const schedules = list(projectId)
      const existing = draft.id ? find(projectId, draft.id) : null
      if (existing && existing.lifecycle.state !== 'active') throw new Error('Completed or cancelled Task Schedules cannot be edited')
      const saved = normalizeScheduleDraft(draft, existing?.lifecycle.state === 'active' ? { ...existing, lifecycle: existing.lifecycle } : null, Date.now())
      saved.id = existing?.id ?? `catalog-schedule-${++sequence}`
      projects.set(projectId, existing ? schedules.map(schedule => schedule.id === saved.id ? saved : schedule) : [...schedules, saved])
      return structuredClone(saved)
    } },
    deleteSchedule: { async handler(payload) {
      await wait('deleteSchedule')
      const { projectId, scheduleId } = requireScheduleIdRequest(payload)
      find(projectId, scheduleId)
      projects.set(projectId, list(projectId).filter(schedule => schedule.id !== scheduleId))
      return { deleted: true }
    } },
    runNow: { async handler(payload) {
      const { projectId, scheduleId } = requireScheduleIdRequest(payload)
      const key = JSON.stringify([projectId, scheduleId])
      if (runs.has(key)) throw new Error('This Task Schedule is already running')
      const cancellation = new AbortController()
      runs.set(key, cancellation)
      try {
        await wait('runNow', cancellation.signal)
        const schedule = find(projectId, scheduleId)
        if (schedule.lifecycle.state !== 'active') throw new Error('Completed or cancelled Task Schedules cannot be run')
        const status = cancellation.signal.aborted ? 'cancelled' : definition.runOutcome ?? (schedule.mode === 'create-only' ? 'created' : 'started')
        const taskId = status === 'started' || status === 'created' ? `CATALOG-${++fireSequence}` : undefined
        const messages: Record<ScheduledFireStatus, string> = {
          started: `Created and started scheduled Task ${taskId}`,
          created: `Created scheduled Task ${taskId}`,
          skipped: 'Skipped because the previous scheduled Task is still open',
          failed: 'The local scheduling service could not create the Task',
          cancelled: 'Run cancelled before creating a Task',
        }
        const outcome: ScheduledFireOutcome = { id: `catalog-fire-${++sequence}`, firedAt: Date.now(), trigger: 'manual', status, taskId, message: messages[status] }
        const updated = { ...schedule, lifecycle: schedule.lifecycle, history: [...schedule.history, outcome].slice(-5), lastTaskId: taskId ?? schedule.lastTaskId, updatedAt: Date.now() }
        const saved = updated.timing.type === 'once' && taskId ? completeOneOffSchedule(updated, Date.now()) : updated
        projects.set(projectId, list(projectId).map(candidate => candidate.id === scheduleId ? saved : candidate))
        return structuredClone(outcome)
      } finally { runs.delete(key) }
    } },
    cancelRunNow: { async handler(payload) {
      await wait('cancelRunNow')
      const { projectId, scheduleId } = requireScheduleIdRequest(payload)
      const run = runs.get(JSON.stringify([projectId, scheduleId]))
      run?.abort()
      return { cancelled: Boolean(run) }
    } },
  }
  return {
    methods,
    get pendingCount() { return pending.size },
    release(method: ScheduleMethod) {
      deferred.delete(method)
      failures.delete(method)
      for (const request of [...pending]) if (request.method === method) request.resolve()
    },
    dispose() {
      disposed = true
      for (const request of [...pending]) request.reject(new Error('Story schedule backend disposed'))
      runs.clear()
    },
  }
}

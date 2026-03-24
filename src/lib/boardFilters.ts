import type { Task, AgentSession, PullRequestInfo } from './types'
import type { TaskState } from './taskState'
import { computeTaskState } from './taskState'

export type BoardFilter = 'focus' | 'in-progress' | 'done'

const FOCUS_STATES: TaskState[] = ['needs-input', 'ci-failed', 'changes-requested', 'sad']

export function isFocusTask(_task: Task, state: TaskState, prs: PullRequestInfo[]): boolean {
  if (state === 'done') {
    return false
  }

  if (FOCUS_STATES.includes(state)) {
    return true
  }

  return prs.some(pr => pr.unaddressed_comment_count > 0)
}

export function filterTasks(
  tasks: Task[],
  filter: BoardFilter,
  sessions: Map<string, AgentSession>,
  prs: Map<string, PullRequestInfo[]>
): Task[] {
  if (filter === 'focus') {
    return tasks.filter(task => {
      const session = sessions.get(task.id) ?? null
      const taskPrs = prs.get(task.id) ?? []
      const state = computeTaskState(task, session, taskPrs)
      return isFocusTask(task, state, taskPrs)
    })
  }

  if (filter === 'in-progress') {
    return tasks.filter(task => task.status !== 'done')
  }

  if (filter === 'done') {
    return tasks.filter(task => task.status === 'done')
  }

  return []
}

export function getFilterCounts(
  tasks: Task[],
  sessions: Map<string, AgentSession>,
  prs: Map<string, PullRequestInfo[]>
): Record<BoardFilter, number> {
  const counts: Record<BoardFilter, number> = {
    focus: 0,
    'in-progress': 0,
    done: 0,
  }

  for (const task of tasks) {
    if (task.status === 'done') {
      counts.done++
    } else {
      counts['in-progress']++
    }

    const session = sessions.get(task.id) ?? null
    const taskPrs = prs.get(task.id) ?? []
    const state = computeTaskState(task, session, taskPrs)
    if (isFocusTask(task, state, taskPrs)) {
      counts.focus++
    }
  }

  return counts
}

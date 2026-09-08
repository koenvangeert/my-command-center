import { describe, expect, it, vi } from 'vitest'
import { createTask } from '../App.test-fixtures/tasks'
import { useAppTaskCreationController } from './appTaskCreationController.svelte'
import { activateCachedTaskDetail, cacheTaskRead, clearActiveTasks, evictTask, installActiveTasks } from './tasksState'

const backlogTask = createTask({ id: 'T-1', status: 'backlog' })

function setup() {
  const options = {
    getTasks: () => [backlogTask],
    loadTasks: vi.fn(async () => {}),
    publishTask: vi.fn(),
    resetToBoard: vi.fn(),
    navigateToTask: vi.fn(),
    runAction: vi.fn(async () => {}),
    reportError: vi.fn(),
  }
  return { options, controller: useAppTaskCreationController(options) }
}

describe('App task creation controller', () => {
  it('opens create and editable backlog task dialogs through one interface', () => {
    const { controller } = setup()
    controller.openNewTask()
    expect(controller.dialog).toEqual({ mode: 'create', task: null })
    controller.openEditTask(backlogTask.id)
    expect(controller.dialog).toEqual({ mode: 'edit', task: backlogTask })
    controller.closeTaskDialog()
    expect(controller.dialog).toBeNull()
  })

  it.each(['board', 'task', 'plugin'] as const)('leaves the current %s location untouched when saving to backlog', async (page) => {
    const { options, controller } = setup()
    const location = { page, selectedTask: page === 'task' ? 'existing-task' : null, filter: 'my-label' }
    const before = { ...location }
    options.resetToBoard.mockImplementation(() => { location.page = 'board'; location.selectedTask = null; location.filter = '' })
    options.navigateToTask.mockImplementation(() => { location.page = 'task'; location.selectedTask = 'T-1' })
    controller.openNewTask()
    controller.taskCreated(backlogTask, 'backlog')
    await Promise.resolve()
    expect(controller.dialog).toBeNull()
    expect(location).toEqual(before)
    expect(options.publishTask).toHaveBeenCalledWith(backlogTask)
    expect(options.runAction).not.toHaveBeenCalled()
    expect(options.resetToBoard).not.toHaveBeenCalled()
    expect(options.navigateToTask).not.toHaveBeenCalled()
  })

  it('keeps saved detail available when a real cache refresh omits the new task', async () => {
    const { options, controller } = setup()
    clearActiveTasks()
    options.publishTask.mockImplementation(task => cacheTaskRead(task.projectId, { task, related: [] }))
    options.loadTasks.mockImplementation(async () => { installActiveTasks(backlogTask.projectId, { tasks: [], related: [] }) })
    try {
      controller.openNewTask()
      controller.taskCreated(backlogTask, 'start')
      await Promise.resolve()
      expect(activateCachedTaskDetail(backlogTask.projectId, backlogTask.id)).toEqual(backlogTask)
      expect(controller.dialog).toBeNull()
    } finally {
      evictTask(backlogTask.id)
      clearActiveTasks()
    }
  })

  it('keeps the saved task open when a background refresh fails', async () => {
    const { options, controller } = setup()
    options.loadTasks.mockRejectedValue(new Error('offline'))
    controller.openNewTask()
    controller.taskCreated(backlogTask, 'start')
    await vi.waitFor(() => expect(options.reportError).toHaveBeenCalled())
    expect(controller.dialog).toBeNull()
    expect(options.publishTask).toHaveBeenCalledWith(backlogTask)
    expect(options.navigateToTask).toHaveBeenCalledExactlyOnceWith('T-1')
    expect(options.runAction).toHaveBeenCalledTimes(1)
  })

  it('closes and presents the saved task while refresh and startup are unresolved', async () => {
    const { options, controller } = setup()
    let finishRefresh!: () => void
    let finishStart!: () => void
    options.loadTasks.mockImplementation(() => new Promise(resolve => { finishRefresh = resolve }))
    options.runAction.mockImplementation(() => new Promise(resolve => { finishStart = resolve }))
    options.navigateToTask.mockImplementation(() => {
      expect(options.publishTask).toHaveBeenCalledWith(backlogTask)
      expect(controller.dialog).toBeNull()
    })
    controller.openNewTask()
    controller.taskCreated(backlogTask, 'start')
    expect(options.navigateToTask).toHaveBeenCalledExactlyOnceWith('T-1')
    expect(options.runAction).toHaveBeenCalledExactlyOnceWith({ taskId: 'T-1', actionPrompt: '' })
    finishRefresh()
    finishStart()
    await Promise.resolve()
    expect(controller.dialog).toBeNull()
  })
})

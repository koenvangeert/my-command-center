<script lang="ts">
  import type { Task, AgentSession, KanbanColumn, Action } from '../lib/types'
  import { COLUMNS, COLUMN_LABELS } from '../lib/types'
  import { tasks, selectedTaskId, activeSessions, ticketPrs, error, activeProjectId } from '../lib/stores'
  import { updateTaskStatus, deleteTask } from '../lib/ipc'
  import { loadActions, getEnabledActions } from '../lib/actions'
  import TaskCard from './TaskCard.svelte'

  interface Props {
    onRunAction?: (data: { taskId: string; actionPrompt: string; agent: string | null }) => void
  }

  let { onRunAction }: Props = $props()

  function tasksForColumn(allTasks: Task[], column: KanbanColumn): Task[] {
    return allTasks.filter(t => t.status === column)
  }

  function getSession(sessions: Map<string, AgentSession>, taskId: string): AgentSession | null {
    return sessions.get(taskId) || null
  }

  function handleSelect(taskId: string) {
    $selectedTaskId = taskId
  }

  let contextMenu = $state({ visible: false, x: 0, y: 0, taskId: '', showMoveSubmenu: false })
  let actions = $state<Action[]>([])
  
  $effect(() => {
    if ($activeProjectId) {
      loadActions($activeProjectId).then(a => { actions = getEnabledActions(a) })
    }
  })

  let contextSession = $derived(contextMenu.taskId ? $activeSessions.get(contextMenu.taskId) : null)
  let isSessionBusy = $derived(contextSession?.status === 'running' || contextSession?.status === 'paused')
  let busyReason = $derived(contextSession?.status === 'running' ? 'Agent is busy' : contextSession?.status === 'paused' ? 'Answer pending question first' : '')

  function handleContextMenu(event: MouseEvent, taskId: string) {
    event.preventDefault()
    contextMenu = { visible: true, x: event.clientX, y: event.clientY, taskId, showMoveSubmenu: false }
  }

  function closeContextMenu() {
    contextMenu = { ...contextMenu, visible: false, showMoveSubmenu: false }
  }

  function toggleMoveSubmenu() {
    contextMenu = { ...contextMenu, showMoveSubmenu: !contextMenu.showMoveSubmenu }
  }

  function handleRunAction(action: Action) {
    const taskId = contextMenu.taskId
    closeContextMenu()
    onRunAction?.({ taskId, actionPrompt: action.prompt, agent: action.agent ?? null })
  }

  async function handleMoveTo(column: KanbanColumn) {
    const taskId = contextMenu.taskId
    closeContextMenu()
    try {
      await updateTaskStatus(taskId, column)
    } catch (err: unknown) {
      console.error('Failed to move task:', err)
      $error = String(err)
    }
  }

  async function handleDelete() {
    const taskId = contextMenu.taskId
    closeContextMenu()
    try {
      await deleteTask(taskId)
      if ($selectedTaskId === taskId) {
        $selectedTaskId = null
      }
    } catch (err: unknown) {
      console.error('Failed to delete task:', err)
      $error = String(err)
    }
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="flex gap-3 p-4 h-full overflow-x-auto">
  {#each COLUMNS as column}
    {@const columnTasks = tasksForColumn($tasks, column)}
    <div class="flex-1 min-w-0 flex flex-col bg-base-200 rounded-lg border border-base-300">
       <div class="flex items-center justify-between px-3.5 py-3 border-b border-base-300">
         <span class="text-xs font-semibold text-base-content uppercase tracking-wider">{COLUMN_LABELS[column]}</span>
         <div class="flex items-center gap-2">
           <span class="badge badge-ghost badge-sm">{columnTasks.length}</span>
         </div>
       </div>
      <div class="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
        {#each columnTasks as task (task.id)}
          <div oncontextmenu={(e: MouseEvent) => handleContextMenu(e, task.id)}>
            <TaskCard {task} session={getSession($activeSessions, task.id)} pullRequests={$ticketPrs.get(task.id) || []} onSelect={handleSelect} />
          </div>
        {/each}
        {#if columnTasks.length === 0}
          <div class="text-center text-xs text-base-content/50 py-5">No tasks</div>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if contextMenu.visible}
  <div class="fixed z-[100] bg-base-300 border border-base-300 rounded-lg shadow-xl min-w-[180px] p-1" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
    {#each actions as action (action.id)}
      <button
        class="context-item block w-full text-left px-3 py-2 text-sm text-base-content cursor-pointer rounded {isSessionBusy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary hover:text-primary-content'}"
        disabled={isSessionBusy}
        title={isSessionBusy ? busyReason : action.name}
        onclick={() => handleRunAction(action)}
      >
        {action.name}
      </button>
    {/each}
    <div class="h-px bg-base-300 my-1"></div>
    <button class="context-item block w-full text-left px-3 py-2 text-sm text-base-content cursor-pointer rounded hover:bg-primary hover:text-primary-content" onclick={(e: MouseEvent) => { e.stopPropagation(); toggleMoveSubmenu() }}>
      Move to... ›
    </button>
    {#if contextMenu.showMoveSubmenu}
      <div class="border-t border-base-300 mt-0.5 pt-0.5">
        {#each COLUMNS as col}
          <button class="context-item block w-full text-left px-3 py-2 text-sm text-base-content cursor-pointer rounded hover:bg-primary hover:text-primary-content" onclick={() => handleMoveTo(col)}>
            {COLUMN_LABELS[col]}
          </button>
        {/each}
      </div>
    {/if}
    <div class="h-px bg-base-300 my-1"></div>
    <button class="context-item block w-full text-left px-3 py-2 text-sm text-error cursor-pointer rounded hover:bg-error hover:text-error-content" onclick={handleDelete}>Delete</button>
  </div>
{/if}

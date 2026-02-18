<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { Task, AgentSession, KanbanColumn } from '../lib/types'
  import { COLUMNS, COLUMN_LABELS } from '../lib/types'
  import { tasks, selectedTaskId, activeSessions, ticketPrs, error, activeProjectId } from '../lib/stores'
  import { updateTaskStatus, deleteTask, getTasksForProject } from '../lib/ipc'
  import TaskCard from './TaskCard.svelte'
  import AddTaskInline from './AddTaskInline.svelte'

  const dispatch = createEventDispatcher()

  function tasksForColumn(allTasks: Task[], column: KanbanColumn): Task[] {
    return allTasks.filter(t => t.status === column)
  }

  function getSession(sessions: Map<string, AgentSession>, taskId: string): AgentSession | null {
    return sessions.get(taskId) || null
  }

  function handleSelect(event: CustomEvent<string>) {
    $selectedTaskId = event.detail
  }

  async function handleTaskCreated() {
    if (!$activeProjectId) return
    try {
      $tasks = await getTasksForProject($activeProjectId)
    } catch (err: unknown) {
      console.error('Failed to reload tasks:', err)
    }
  }

  let contextMenu = { visible: false, x: 0, y: 0, taskId: '', showMoveSubmenu: false }

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

  async function handleStartImplementation() {
    const taskId = contextMenu.taskId
    closeContextMenu()
    dispatch('start-implementation', { taskId })
  }

  async function handleMoveTo(column: KanbanColumn) {
    const taskId = contextMenu.taskId
    closeContextMenu()
    if (!$activeProjectId) return
    try {
      await updateTaskStatus(taskId, column)
      $tasks = await getTasksForProject($activeProjectId)
    } catch (err: unknown) {
      console.error('Failed to move task:', err)
      $error = String(err)
    }
  }

  async function handleDelete() {
    const taskId = contextMenu.taskId
    closeContextMenu()
    if (!$activeProjectId) return
    try {
      await deleteTask(taskId)
      if ($selectedTaskId === taskId) {
        $selectedTaskId = null
      }
      $tasks = await getTasksForProject($activeProjectId)
    } catch (err: unknown) {
      console.error('Failed to delete task:', err)
      $error = String(err)
    }
  }
</script>

<svelte:window on:click={closeContextMenu} />

<div class="kanban">
  {#each COLUMNS as column}
    {@const columnTasks = tasksForColumn($tasks, column)}
    <div class="column">
      <div class="column-header">
        <span class="column-name">{COLUMN_LABELS[column]}</span>
        <div class="column-header-right">
          <span class="column-count">{columnTasks.length}</span>
          <AddTaskInline {column} on:task-created={handleTaskCreated} />
        </div>
      </div>
      <div class="column-body">
        {#each columnTasks as task (task.id)}
          <div on:contextmenu={(e) => handleContextMenu(e, task.id)}>
            <TaskCard {task} session={getSession($activeSessions, task.id)} pullRequests={$ticketPrs.get(task.id) || []} on:select={handleSelect} />
          </div>
        {/each}
        {#if columnTasks.length === 0}
          <div class="empty-column">No tasks</div>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if contextMenu.visible}
  <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
    <button class="context-item" on:click={handleStartImplementation}>Start Implementation</button>
    <button class="context-item has-submenu" on:click|stopPropagation={toggleMoveSubmenu}>
      Move to...
    </button>
    {#if contextMenu.showMoveSubmenu}
      <div class="submenu">
        {#each COLUMNS as col}
          <button class="context-item" on:click={() => handleMoveTo(col)}>
            {COLUMN_LABELS[col]}
          </button>
        {/each}
      </div>
    {/if}
    <div class="context-divider"></div>
    <button class="context-item context-delete" on:click={handleDelete}>Delete</button>
  </div>
{/if}

<style>
  .kanban {
    display: flex;
    gap: 12px;
    padding: 16px;
    height: 100%;
    overflow-x: auto;
  }

  .column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }

  .column-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .column-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .column-count {
    font-size: 0.7rem;
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .column-body {
    flex: 1;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }

  .empty-column {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 20px 0;
  }

  .context-menu {
    position: fixed;
    z-index: 100;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    min-width: 180px;
    padding: 4px;
  }

  .context-item {
    all: unset;
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    font-size: 0.8rem;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: 4px;
  }

  .context-item:hover {
    background: var(--accent);
    color: var(--bg-primary);
  }

  .has-submenu::after {
    content: ' >';
    float: right;
    color: var(--text-secondary);
  }

  .submenu {
    border-top: 1px solid var(--border);
    margin-top: 2px;
    padding-top: 2px;
  }

  .context-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .context-delete {
    color: var(--error);
  }

  .context-delete:hover {
    background: var(--error);
    color: white;
  }
</style>

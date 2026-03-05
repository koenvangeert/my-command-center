<script lang="ts">
  import { onMount } from 'svelte'
  import type { Task, Action } from '../lib/types'
  import { selectedTaskId, activeSessions, activeProjectId } from '../lib/stores'
  import { getWorktreeForTask, updateTaskStatus, openUrl, getConfig, updateTask } from '../lib/ipc'
  import { navigateBack } from '../lib/navigation'
  import { loadActions, getEnabledActions } from '../lib/actions'
  import AgentPanel from './AgentPanel.svelte'
  import TaskInfoPanel from './TaskInfoPanel.svelte'
  import ResizablePanel from './ResizablePanel.svelte'
  import SelfReviewView from './SelfReviewView.svelte'
  import TaskTerminal from './TaskTerminal.svelte'

  interface Props {
    task: Task
    onRunAction: (data: { taskId: string; actionPrompt: string; agent: string | null }) => void
    onTaskUpdated?: () => void
  }

  let { task, onRunAction, onTaskUpdated }: Props = $props()

  let reviewMode = $state(false)
  let rightPanelMode = $state<'info' | 'terminal'>('info')
  let worktreePath = $state<string | null>(null)
  let jiraBaseUrl = $state('')
  // Plain variable (not $state) so it's not tracked as a reactive dependency.
  // Used to detect actual task changes vs. same-task prop re-renders.
  let lastTaskId = ''
  let actions = $state<Action[]>([])

  let currentSession = $derived($activeSessions.get(task.id))
  let agentStatus = $derived(currentSession?.status ?? null)
  let isSessionBusy = $derived(currentSession?.status === 'running' || currentSession?.status === 'paused')
  let busyReason = $derived(currentSession?.status === 'running' ? 'Agent is busy' : currentSession?.status === 'paused' ? 'Answer pending question first' : '')

  $effect(() => {
    const taskId = task.id
    if (taskId !== lastTaskId) {
      lastTaskId = taskId
      reviewMode = false
      rightPanelMode = 'info'
      getWorktreeForTask(taskId).then((worktree) => {
        worktreePath = worktree?.worktree_path ?? null
      })
    }
  })

  $effect(() => {
    if ($activeProjectId) {
      loadActions($activeProjectId).then(a => { actions = getEnabledActions(a) })
    }
  })

  onMount(async () => {
    jiraBaseUrl = (await getConfig('jira_base_url')) || ''
  })

  function handleBack() {
    if (!navigateBack()) {
      $selectedTaskId = null
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === task.status) return
    try {
      await updateTaskStatus(task.id, newStatus)
      if (newStatus === 'done') {
        $selectedTaskId = null
      }
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  function handleActionClick(action: Action) {
    onRunAction({ taskId: task.id, actionPrompt: action.prompt, agent: action.agent ?? null })
  }

  function handleSendToAgent(prompt: string) {
    onRunAction({ taskId: task.id, actionPrompt: prompt, agent: null })
  }

  let isEditingHeaderName = $state(false)
  let editedHeaderName = $state('')
  let headerInputEl = $state<HTMLInputElement | null>(null)

  function startEditingHeaderName() {
    editedHeaderName = task.name || ''
    isEditingHeaderName = true
    // Focus after DOM update
    setTimeout(() => headerInputEl?.focus(), 0)
  }

  async function saveHeaderName() {
    const newName = editedHeaderName.trim() || null
    if (newName === (task.name || null)) {
      isEditingHeaderName = false
      return
    }
    try {
      await updateTask(task.id, task.title, task.jira_key, newName)
      isEditingHeaderName = false
      onTaskUpdated?.()
    } catch (e) {
      console.error('Failed to update task name:', e)
    }
  }

  function cancelEditingHeaderName() {
    isEditingHeaderName = false
  }

  function handleHeaderNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveHeaderName()
    } else if (e.key === 'Escape') {
      cancelEditingHeaderName()
    }
  }


</script>

<div class="flex flex-col flex-1 h-full bg-base-100 overflow-hidden">
  <header class="flex flex-col bg-base-200 border-b border-base-300 shrink-0">
    <div class="flex items-center gap-3 px-6 py-3.5">
      <button class="btn btn-ghost btn-sm font-mono text-sm text-secondary border border-base-300 shrink-0 px-2.5 h-7" onclick={handleBack}>
        <span aria-hidden="true">&lt; </span><span>back</span>
      </button>
      <span class="text-base-content/20 select-none">|</span>
      <span class="text-[0.8125rem] font-semibold text-primary font-mono shrink-0">{task.jira_key || task.id}</span>
      {#if task.jira_key && jiraBaseUrl}
        <button
          class="btn btn-ghost btn-xs px-1.5 min-h-0 h-auto text-primary hover:underline"
          onclick={() => openUrl(`${jiraBaseUrl}/browse/${task.jira_key}`)}
          title="Open in Jira"
        >↗</button>
      {/if}
      {#if isEditingHeaderName}
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <input
            bind:this={headerInputEl}
            type="text"
            class="input input-bordered input-sm flex-1 text-lg font-bold min-w-0"
            bind:value={editedHeaderName}
            onkeydown={handleHeaderNameKeydown}
            onblur={saveHeaderName}
            placeholder="Enter task name"
          />
          <button class="btn btn-ghost btn-xs text-success shrink-0" onclick={saveHeaderName} title="Save">✓</button>
          <button class="btn btn-ghost btn-xs text-error shrink-0" onclick={cancelEditingHeaderName} title="Cancel">✗</button>
        </div>
      {:else}
        <h1 class="text-lg font-bold text-base-content m-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 group" title={task.name || task.title.split('\n')[0]}>
          {task.name || task.title.split('\n')[0]}
          <button
            class="btn btn-ghost btn-xs px-1 min-h-0 h-auto align-middle opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            onclick={startEditingHeaderName}
            title="Edit name"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-base-content/50" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </h1>
      {/if}
      {#if task.status !== 'done'}
        <button
          class="btn btn-success btn-sm shrink-0 shadow-sm hover:shadow-md transition-shadow"
          onclick={() => handleStatusChange('done')}
        >
          Move to Done
        </button>
      {/if}
      {#if actions.length > 0}
        <div class="flex gap-1.5 shrink-0">
          {#each actions as action (action.id)}
            <button
              class="btn btn-soft btn-sm shadow-sm hover:shadow-md hover:btn-primary transition-all duration-200"
              disabled={isSessionBusy}
              title={isSessionBusy ? busyReason : action.name}
              onclick={() => handleActionClick(action)}
            >
              {action.name}
            </button>
          {/each}
        </div>
       {/if}
     </div>
   </header>

  <div class="flex items-center justify-between h-10 px-6 border-b border-base-300 shrink-0">
    <div class="flex items-center gap-1 font-mono text-xs">
      <span class="text-base-content/50">$ cd board</span>
      <span class="text-base-content/20 mx-1">/</span>
      <span class="text-base-content/50">{task.status}</span>
      <span class="text-base-content/20 mx-1">/</span>
      <span class="text-primary font-semibold">{task.jira_key || task.id}</span>
      <span class="text-base-content/20 mx-1">/</span>
      <span class="text-primary font-semibold">{reviewMode ? 'self_review' : 'code'}</span>
    </div>
    {#if worktreePath !== null}
      <div class="flex items-center gap-1">
        <button
          class="btn btn-ghost btn-xs {!reviewMode ? 'text-primary border border-primary' : 'text-base-content/50 border border-base-300'}"
          onclick={() => reviewMode = false}
        >code_view</button>
        <button
          class="btn btn-ghost btn-xs {reviewMode ? 'text-primary border border-primary' : 'text-base-content/50 border border-base-300'}"
          onclick={() => reviewMode = true}
        >review_view</button>
      </div>
    {/if}
  </div>

  <div class="flex flex-1 overflow-hidden max-[800px]:flex-col">
    {#if reviewMode}
      <SelfReviewView {task} {agentStatus} onSendToAgent={handleSendToAgent} />
    {:else}
       <div class="flex-1 p-5 overflow-hidden max-[800px]:p-4">
         <AgentPanel taskId={task.id} />
       </div>
       <ResizablePanel storageKey="task-detail-sidebar" defaultWidth={360} minWidth={200} maxWidth={600} side="right">
         <div class="overflow-hidden bg-base-200 border-l border-base-300 flex flex-col h-full">
           {#if worktreePath !== null}
             <div class="flex items-center h-10 bg-base-200 border-b border-base-300 shrink-0 px-1">
               <button
                 class="flex items-center gap-1.5 h-full px-3.5 text-xs font-mono transition-colors {rightPanelMode === 'info' ? 'text-base-content font-semibold border-b-2 border-primary' : 'text-base-content/50'}"
                 onclick={() => rightPanelMode = 'info'}
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                 Info
               </button>
               <button
                 class="flex items-center gap-1.5 h-full px-3.5 text-xs font-mono transition-colors {rightPanelMode === 'terminal' ? 'text-base-content font-semibold border-b-2 border-primary' : 'text-base-content/50'}"
                 onclick={() => rightPanelMode = 'terminal'}
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
                 Terminal
               </button>
             </div>
           {/if}
           <div class="flex-1 overflow-y-auto">
             {#if rightPanelMode === 'terminal' && worktreePath !== null}
               <TaskTerminal taskId={task.id} {worktreePath} />
             {:else}
               <TaskInfoPanel task={task} {worktreePath} {jiraBaseUrl} {onTaskUpdated} />
             {/if}
           </div>
         </div>
       </ResizablePanel>
    {/if}
  </div>
</div>

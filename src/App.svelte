<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { listen } from '@tauri-apps/api/event'
  import type { UnlistenFn } from '@tauri-apps/api/event'
  import { tasks, selectedTaskId, activeSessions, ticketPrs, error, isLoading } from './lib/stores'
  import { getTasks, getOpenCodeStatus, getSessionStatus, checkOpenCodeInstalled, getPullRequests } from './lib/ipc'
  import type { Task, PullRequestInfo, OpenCodeStatus, PrComment } from './lib/types'
  import KanbanBoard from './components/KanbanBoard.svelte'
  import DetailPanel from './components/DetailPanel.svelte'
  import AddTaskDialog from './components/AddTaskDialog.svelte'
  import SettingsPanel from './components/SettingsPanel.svelte'
  import Toast from './components/Toast.svelte'

  let openCodeStatus: OpenCodeStatus | null = null
  let unlisteners: UnlistenFn[] = []
  let showSettings = false
  let prComments: PrComment[] = []
  let openCodeInstalled: boolean | null = null
  let showAddDialog = false
  let editingTask: Task | null = null
  let dialogMode: 'create' | 'edit' = 'create'

  $: selectedTask = $tasks.find(t => t.id === $selectedTaskId) || null

  async function loadTasks() {
    $isLoading = true
    try {
      $tasks = await getTasks()
    } catch (e) {
      console.error('Failed to load tasks:', e)
      $error = String(e)
    } finally {
      $isLoading = false
    }
  }

  async function loadPullRequests() {
    try {
      const prs = await getPullRequests()
      const grouped = new Map<string, PullRequestInfo[]>()
      for (const pr of prs) {
        const existing = grouped.get(pr.ticket_id) || []
        existing.push(pr)
        grouped.set(pr.ticket_id, existing)
      }
      $ticketPrs = grouped
    } catch (e) {
      console.error('Failed to load pull requests:', e)
    }
  }

  async function checkOpenCode() {
    try {
      openCodeStatus = await getOpenCodeStatus()
    } catch (e) {
      openCodeStatus = null
    }
  }

  onMount(async () => {
    try {
      const installStatus = await checkOpenCodeInstalled()
      openCodeInstalled = installStatus.installed
    } catch {
      openCodeInstalled = false
    }

    await loadTasks()
    await loadPullRequests()
    await checkOpenCode()

    unlisteners.push(
      await listen('jira-sync-complete', () => {
        loadTasks()
      })
    )

    unlisteners.push(
      await listen<{ ticket_id: string; session_id: string; stage: string; data: unknown }>('checkpoint-reached', async (event) => {
        try {
          const session = await getSessionStatus(event.payload.session_id)
          $activeSessions = new Map($activeSessions).set(session.ticket_id, session)
        } catch (e) {
          console.error('Failed to get session status:', e)
        }
      })
    )

    unlisteners.push(
      await listen<{ ticket_id: string; session_id: string; stage: string }>('stage-completed', async (event) => {
        try {
          const session = await getSessionStatus(event.payload.session_id)
          $activeSessions = new Map($activeSessions).set(session.ticket_id, session)
          await loadTasks()
        } catch (e) {
          console.error('Failed to get session status:', e)
        }
      })
    )

    unlisteners.push(
      await listen('new-pr-comment', () => {
        loadTasks()
        loadPullRequests()
      })
    )

    unlisteners.push(
      await listen<{ ticket_id: string; session_id: string }>('session-aborted', (event) => {
        const updated = new Map($activeSessions)
        updated.delete(event.payload.ticket_id)
        $activeSessions = updated
      })
    )
  })

  onDestroy(() => {
    unlisteners.forEach(fn => fn())
  })
</script>

<div class="app">
  <header class="top-bar">
    <h1 class="app-title">AI Command Center</h1>
    <div class="status-bar">
      <button class="settings-btn" on:click={() => showSettings = !showSettings}>
        {showSettings ? 'Board' : 'Settings'}
      </button>
      {#if openCodeStatus}
        <span class="status-indicator" class:healthy={openCodeStatus.healthy} class:unhealthy={!openCodeStatus.healthy}>
          <span class="dot"></span>
          OpenCode {openCodeStatus.healthy ? 'Connected' : 'Disconnected'}
        </span>
      {:else}
        <span class="status-indicator unhealthy">
          <span class="dot"></span>
          OpenCode Unavailable
        </span>
      {/if}
    </div>
  </header>

  {#if openCodeInstalled === false}
    <div class="setup-banner">
      <strong>OpenCode CLI not found.</strong>
      Install it to enable AI agent features:
      <code>curl -fsSL https://opencode.ai/install | bash</code>
      <button class="dismiss-btn" on:click={() => openCodeInstalled = null}>Dismiss</button>
    </div>
  {/if}

  <main class="main-content">
    {#if showSettings}
      <SettingsPanel on:close={() => showSettings = false} />
    {:else}
      <div class="board-area" class:has-detail={selectedTask !== null}>
        {#if $isLoading && $tasks.length === 0}
          <div class="loading-overlay">
            <div class="spinner"></div>
            <span>Loading tasks...</span>
          </div>
        {:else}
          <KanbanBoard />
        {/if}
      </div>
      {#if selectedTask}
        <div class="detail-area">
          <DetailPanel task={selectedTask} comments={prComments} on:close={() => $selectedTaskId = null} on:edit={() => { editingTask = selectedTask; dialogMode = 'edit'; showAddDialog = true }} />
        </div>
      {/if}
    {/if}

    {#if showAddDialog}
      <AddTaskDialog mode={dialogMode} task={editingTask} on:close={() => { showAddDialog = false; editingTask = null }} on:task-saved={() => { showAddDialog = false; editingTask = null; loadTasks() }} />
    {/if}
  </main>
</div>

<Toast />

<style>
  :global(:root) {
    --bg-primary: #1a1b26;
    --bg-secondary: #24283b;
    --bg-card: #2f3349;
    --text-primary: #c0caf5;
    --text-secondary: #565f89;
    --accent: #7aa2f7;
    --success: #9ece6a;
    --warning: #e0af68;
    --error: #f7768e;
    --border: #3b4261;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 48px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .app-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary);
  }

  .healthy .dot {
    background: var(--success);
  }

  .unhealthy .dot {
    background: var(--error);
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .board-area {
    flex: 1;
    overflow: hidden;
  }

  .board-area.has-detail {
    flex: 1;
  }

  .detail-area {
    width: 400px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .settings-btn {
    all: unset;
    padding: 4px 12px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
  }

  .settings-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .setup-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: var(--warning);
    color: var(--bg-primary);
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .setup-banner code {
    background: rgba(0, 0, 0, 0.15);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .dismiss-btn {
    all: unset;
    margin-left: auto;
    cursor: pointer;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .dismiss-btn:hover {
    opacity: 1;
  }

  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

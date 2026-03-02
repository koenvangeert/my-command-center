<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { activeSessions } from '../lib/stores'
  import { abortImplementation, getLatestSession, getAgentLogs, getWorktreeForTask } from '../lib/ipc'
  import { parseCheckpointQuestion } from '../lib/parseCheckpoint'
  import { useClaudeSession } from '../lib/useClaudeSession.svelte'
  import VoiceInput from './VoiceInput.svelte'
  import ClaudeChatView from './ClaudeChatView.svelte'
  import ChatInput from './ChatInput.svelte'

  interface Props {
    taskId: string
  }

  let { taskId }: Props = $props()

  // Composable — manages SDK session state, event listeners, and IPC calls
  const claudeSession = useClaudeSession(taskId)

  // Local state
  let loadingHistory = $state(false)

  // Derived state
  let session = $derived($activeSessions.get(taskId) || null)
  let questionText = $derived(session ? parseCheckpointQuestion(session.checkpoint_data) : null)
  let isRunning = $derived(claudeSession.state.status === 'running')
  let canResume = $derived(
    (claudeSession.state.status === 'interrupted' || claudeSession.state.status === 'completed') &&
    claudeSession.state.sessionId !== null
  )
  let inputDisabled = $derived(
    claudeSession.state.status !== 'running' && claudeSession.state.status !== 'idle'
  )

  // Lifecycle
  onMount(async () => {
    await claudeSession.setup()
    await loadHistory()
  })

  onDestroy(() => {
    claudeSession.cleanup()
  })

  // ============================================================================
  // History loading
  // ============================================================================

  async function loadHistory(): Promise<void> {
    loadingHistory = true
    try {
      let existingSession = $activeSessions.get(taskId) ?? null

      if (!existingSession) {
        const dbSession = await getLatestSession(taskId)
        if (dbSession && ['completed', 'failed', 'paused', 'interrupted'].includes(dbSession.status)) {
          const updated = new Map($activeSessions)
          updated.set(taskId, dbSession)
          $activeSessions = updated
          existingSession = dbSession
        }
      }

      if (!existingSession) return

      // Replay stored events as SDKChatMessage objects
      try {
        const logs = await getAgentLogs(existingSession.id)
        for (const log of logs) {
          try {
            const data = JSON.parse(log.content) as Record<string, unknown>
            if (log.log_type === 'assistant') {
              const text = typeof data.text === 'string' ? data.text : ''
              if (text) {
                claudeSession.state.messages.push({
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: text,
                  timestamp: log.timestamp,
                  status: 'complete' as const,
                  toolCalls: null,
                })
              }
            } else if (log.log_type === 'system.init') {
              const sessionId = typeof data.sessionId === 'string' ? data.sessionId : null
              if (sessionId) {
                claudeSession.state.sessionId = sessionId
              }
            }
          } catch { /* skip unparseable logs */ }
        }
      } catch (e) {
        console.error('[ClaudeAgentPanel] Failed to load agent logs:', e)
      }

      // Sync session status from DB record
      if (existingSession.status === 'completed') {
        claudeSession.state.status = 'completed'
      } else if (existingSession.status === 'failed') {
        claudeSession.state.status = 'failed'
      } else if (existingSession.status === 'interrupted') {
        claudeSession.state.status = 'interrupted'
      }
    } catch (e) {
      console.error('[ClaudeAgentPanel] Failed to load session history:', e)
    } finally {
      loadingHistory = false
    }
  }

  // ============================================================================
  // Action handlers
  // ============================================================================

  async function handleAbort(): Promise<void> {
    try {
      await abortImplementation(taskId)
      claudeSession.state.status = 'failed'
    } catch (e) {
      console.error('[ClaudeAgentPanel] Failed to abort implementation:', e)
    }
  }

  async function handleInterrupt(): Promise<void> {
    await claudeSession.interrupt()
  }

  async function handleResume(): Promise<void> {
    if (!claudeSession.state.sessionId) return
    try {
      const worktree = await getWorktreeForTask(taskId)
      if (!worktree) return
      await claudeSession.resume(claudeSession.state.sessionId, worktree.worktree_path)
    } catch (e) {
      console.error('[ClaudeAgentPanel] Failed to resume session:', e)
    }
  }

  function handleTranscription(text: string): void {
    void claudeSession.sendInput(text)
  }

  // ============================================================================
  // Display helpers
  // ============================================================================

  function getStatusText(): string {
    switch (claudeSession.state.status) {
      case 'idle': return 'No active implementation'
      case 'running': return 'Agent running...'
      case 'completed': return 'Implementation complete'
      case 'failed': return 'Error occurred'
      case 'interrupted': return 'Session interrupted'
      default: return ''
    }
  }

  function getStatusDotClass(): string {
    switch (claudeSession.state.status) {
      case 'idle': return 'status status-neutral'
      case 'running': return 'status status-success'
      case 'completed': return 'status status-primary'
      case 'failed':
      case 'interrupted': return 'status status-error'
      default: return 'status status-neutral'
    }
  }

  function getStageLabel(stage: string): string {
    const stageMap: Record<string, string> = {
      'read_ticket': 'Reading Ticket',
      'implement': 'Implementing',
      'create_pr': 'Creating PR',
      'address_comments': 'Addressing Comments'
    }
    return stageMap[stage] || stage
  }

  function getSessionStatusBadgeClass(sessionStatus: string): string {
    switch (sessionStatus) {
      case 'running': return 'badge-success'
      case 'completed': return 'badge-primary'
      case 'failed': return 'badge-error'
      case 'interrupted': return 'badge-ghost'
      case 'paused': return 'badge-warning'
      default: return 'badge-ghost'
    }
  }
</script>

<div class="flex flex-col gap-3 h-full">
  <!-- Status header -->
  <div class="flex items-center justify-between px-5 py-3.5 bg-base-200 border border-base-300 rounded-md">
    <div class="flex items-start gap-2.5">
      <span class="mt-1.5 shrink-0 {getStatusDotClass()}"></span>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-base-content">{getStatusText()}</span>
        {#if session}
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-base-content/50 tracking-wide">{getStageLabel(session.stage)}</span>
            <span class="badge badge-sm {getSessionStatusBadgeClass(session.status)}">
              {session.status}
            </span>
            {#if session.claude_session_id}
              <span class="text-[0.6875rem] font-mono text-base-content/50 max-w-[180px] truncate" title={session.claude_session_id}>
                {session.claude_session_id}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2">
      <VoiceInput onTranscription={handleTranscription} listenToHotkey />
      {#if isRunning}
        <button
          class="btn btn-warning btn-sm uppercase tracking-wide shadow-sm hover:shadow-md transition-shadow"
          onclick={handleInterrupt}
        >
          Interrupt
        </button>
        <button
          class="btn btn-error btn-sm uppercase tracking-wide shadow-sm hover:shadow-md transition-shadow"
          onclick={handleAbort}
        >
          Abort
        </button>
      {:else if canResume}
        <button
          class="btn btn-primary btn-sm uppercase tracking-wide shadow-sm hover:shadow-md transition-shadow"
          onclick={handleResume}
        >
          Resume
        </button>
      {/if}
    </div>
  </div>

  <!-- Checkpoint question banner -->
  {#if questionText}
    <div class="flex items-start gap-3 px-5 py-3 bg-warning/10 border border-warning/30 rounded-md">
      <span class="flex items-center justify-center w-5 h-5 rounded-full bg-warning/20 text-warning text-xs font-bold shrink-0 mt-0.5">?</span>
      <span class="text-[0.8125rem] text-base-content leading-relaxed line-clamp-3">{questionText}</span>
    </div>
  {/if}

  <!-- Chat area -->
  <div class="flex-1 overflow-hidden min-h-0 bg-base-100 border border-base-300 rounded-md relative flex flex-col">
    {#if loadingHistory}
      <div class="absolute inset-0 flex flex-col items-center justify-center p-16 gap-4 bg-base-100 z-[1]">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <div class="text-base font-semibold text-base-content">Loading session output...</div>
      </div>
    {:else}
      <div class="flex-1 overflow-hidden min-h-0">
        <ClaudeChatView
          messages={claudeSession.state.messages}
          pendingApprovals={claudeSession.state.pendingApprovals}
          isStreaming={claudeSession.state.status === 'running'}
          onApprove={claudeSession.approveToolUse}
          onDeny={claudeSession.denyToolUse}
        />
      </div>
      <ChatInput
        onSend={claudeSession.sendInput}
        disabled={inputDisabled}
        placeholder={inputDisabled ? 'Session not active' : 'Send a message to Claude...'}
      />
    {/if}
  </div>
</div>

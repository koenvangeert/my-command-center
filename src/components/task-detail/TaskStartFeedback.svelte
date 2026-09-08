<script lang="ts">
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import { activeSessions, startingTasks, taskStartErrors } from '../../lib/stores'

  let { taskId, onRunAction }: {
    taskId: string
    onRunAction: (data: { taskId: string; actionPrompt: string }) => void
  } = $props()

  const isStarting = $derived($startingTasks.has(taskId))
  const startError = $derived($taskStartErrors.get(taskId))
  const isRunning = $derived($activeSessions.get(taskId)?.status === 'running')
</script>

{#if isStarting && !isRunning}
  <div class="shrink-0 border-b border-[var(--of-border)] bg-[var(--of-surface)] px-4 py-3 text-sm text-[var(--of-text-secondary)]" role="status">
    Starting task…
  </div>
{:else if startError && !isRunning}
  <div class="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--of-danger)] bg-[var(--of-danger-subtle)] px-4 py-3 text-sm text-[var(--of-danger)]" role="alert">
    <span class="flex-1 overflow-hidden break-words">{startError}</span>
    <Button size="sm" variant="danger" disabled={isStarting} onclick={() => onRunAction({ taskId, actionPrompt: '' })}>Retry start</Button>
  </div>
{/if}

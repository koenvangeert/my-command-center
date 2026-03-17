<script lang="ts">
  import { X } from 'lucide-svelte'
  import type { ActionItem } from '../lib/types'

  interface Props {
    items: ActionItem[]
    onDismiss: (id: number) => void
    onNavigateToTask: (taskId: string) => void
  }

  const { items, onDismiss, onNavigateToTask }: Props = $props()
</script>

<div class="flex flex-col h-full overflow-hidden">
  <div class="px-4 py-3 border-b border-base-300 shrink-0">
    <span class="text-sm font-semibold text-base-content">Action Items</span>
    {#if items.length > 0}
      <span class="badge badge-primary badge-sm ml-2">{items.length}</span>
    {/if}
  </div>
  <div class="flex-1 overflow-y-auto">
    {#if items.length === 0}
      <div class="flex flex-col items-center justify-center h-full p-6 text-center">
        <p class="text-sm text-base-content/50">No action items</p>
      </div>
    {:else}
      <div class="flex flex-col gap-2 p-3">
        {#each items as item (item.id)}
          <div class="bg-base-200 rounded-lg p-3 flex flex-col gap-1.5">
            <div class="flex items-start justify-between gap-2">
              <span class="text-sm font-medium text-base-content leading-snug">{item.title}</span>
              <button
                class="btn btn-ghost btn-xs shrink-0 text-base-content/40 hover:text-base-content"
                onclick={() => onDismiss(item.id)}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            <p class="text-xs text-base-content/60 leading-relaxed">{item.description}</p>
            {#if item.task_id}
              <button
                class="text-xs text-primary hover:underline text-left w-fit"
                onclick={() => onNavigateToTask(item.task_id!)}
              >
                → {item.task_id}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

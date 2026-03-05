<script lang="ts">
  import type { AgentSession } from '../lib/types'
  import { tasks, activeSessions } from '../lib/stores'
  import { computeCreatureState } from '../lib/creatureState'
  import { parseCheckpointQuestion } from '../lib/parseCheckpoint'
  import Creature from './Creature.svelte'

  interface Props {
    onCreatureClick: (taskId: string) => void
  }

  let { onCreatureClick }: Props = $props()

  let doingTasks = $derived($tasks.filter(t => t.status === 'doing'))
  let backlogTasks = $derived($tasks.filter(t => t.status === 'backlog'))
  let hasCreatures = $derived(doingTasks.length > 0 || backlogTasks.length > 0)

  function getSession(taskId: string): AgentSession | null {
    return $activeSessions.get(taskId) ?? null
  }
</script>

<div class="flex flex-col h-full bg-gradient-to-b from-base-100 to-base-200">
  {#if !hasCreatures}
    <div class="flex flex-1 items-center justify-center">
      <span class="font-mono text-sm text-base-content/40">No creatures yet</span>
    </div>
  {:else}
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="flex flex-wrap gap-6 p-6 items-end justify-center flex-1">
        {#each doingTasks as task (task.id)}
          {@const session = getSession(task.id)}
          {@const state = computeCreatureState(task, session)}
          {@const questionText = parseCheckpointQuestion(session?.checkpoint_data ?? null)}
          <Creature {task} {state} {questionText} onClick={onCreatureClick} />
        {/each}
      </div>

      <div class="flex flex-wrap gap-6 px-6 py-4 items-center justify-center bg-base-200/60 border-t border-base-300/40 min-h-[120px]">
        {#each backlogTasks as task (task.id)}
          {@const session = getSession(task.id)}
          {@const state = computeCreatureState(task, session)}
          {@const questionText = parseCheckpointQuestion(session?.checkpoint_data ?? null)}
          <Creature {task} {state} {questionText} onClick={onCreatureClick} />
        {/each}
      </div>
    </div>
  {/if}
</div>

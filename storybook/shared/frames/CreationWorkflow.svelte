<script lang="ts">
  import { onDestroy } from 'svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import AddTaskDialog from '../../../src/components/AddTaskDialog.svelte'
  import ProjectSetupDialog from '../../../src/components/project/ProjectSetupDialog.svelte'
  import type { Project, TaskDetail } from '../../../src/lib/types'
  import type { CreationWorkflowKind } from '../fixtures/creationScenario'
  import { creationPrompt, longCreationPrompt } from '../fixtures/creationScenario'
  import { createProject, createTask } from '../fixtures/appFixtures'
  import BoardPage from './BoardPage.svelte'

  let { workflow, state: scenarioState = 'default', reset, onClose = () => {}, onTaskCreated = () => {},
    onTaskSaved = () => {}, onProjectCreated = () => {} }: {
    workflow: CreationWorkflowKind
    state?: string
    reset: () => Promise<void>
    onClose?: () => void
    onTaskCreated?: (task: TaskDetail, intent: 'backlog' | 'start') => void
    onTaskSaved?: () => void
    onProjectCreated?: (project: Project) => void
  } = $props()
  const project = createProject()
  let open = $state(true)
  let generation = $state(0)
  let disposed = false
  onDestroy(() => { disposed = true })
  function close() { if (!disposed) { open = false; onClose() } }
  async function reopen() {
    await reset()
    generation += 1
    open = true
  }
</script>

{#key generation}
  <BoardPage>
    {#snippet dialogs()}
      {#if open && workflow === 'task'}
        <AddTaskDialog projectPath={project.path} projectName={project.name}
          mode={scenarioState === 'edit' ? 'edit' : 'create'}
          task={scenarioState === 'edit' ? createTask({ status: 'backlog', prompt: 'Review keyboard navigation' }) : null}
          promptSeed={scenarioState === 'long-content' ? longCreationPrompt : scenarioState === 'default' ? '' : creationPrompt}
          onClose={close}
          onTaskCreated={(task, intent) => { if (!disposed) onTaskCreated(task, intent) }}
          onTaskSaved={() => { if (!disposed) onTaskSaved() }} />
      {:else if open}
        <ProjectSetupDialog onClose={close} onProjectCreated={(created) => { if (!disposed) { onProjectCreated(created); close() } }} />
      {:else}
        <div class="fixed bottom-4 right-4 z-50"><Button onclick={reopen}>Reopen workflow</Button></div>
      {/if}
    {/snippet}
  </BoardPage>
{/key}

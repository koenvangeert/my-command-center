<script lang="ts">
  import { onMount } from 'svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import ProjectPageHeader from '../../../src/components/project/ProjectPageHeader.svelte'
  import FocusBoard from '../../../src/components/focus-board/FocusBoard.svelte'
  import { createTask } from '../fixtures/appFixtures'
  import AppShortcutHelpDialog from '../../../src/components/shell/AppShortcutHelpDialog.svelte'
  import AppCloseConfirmationDialog from '../../../src/components/shell/AppCloseConfirmationDialog.svelte'
  import ToastHost from '../../../src/components/feedback/toasts/ToastHost.svelte'
  import { useAppShortcutHelpController } from '../../../src/lib/appShortcutHelpController.svelte'
  import { activeProjectId, currentView, projects } from '../../../src/lib/stores'
  import PageFrame from './PageFrame.svelte'

  let { initiallyCollapsed = false, zen = false, global = false, dialog = 'none', longContent = false, controls = false }: {
    controls?: boolean
    initiallyCollapsed?: boolean
    zen?: boolean
    global?: boolean
    dialog?: 'none' | 'shortcuts' | 'quit'
    longContent?: boolean
  } = $props()
  const shortcuts = useAppShortcutHelpController()
  let quitOpen = $state(false)
  const closeController = {
    get confirmationOpen() { return quitOpen },
    cancelClose() { quitOpen = false },
    async confirmClose() { quitOpen = false },
    async handleCloseRequested() { quitOpen = true },
  }
  const project = $derived($projects.find(project => project.id === $activeProjectId))
  onMount(() => {
    if (global) currentView.set('global_settings')
    if (dialog === 'shortcuts') shortcuts.open()
    if (dialog === 'quit') quitOpen = true
  })
</script>

<PageFrame {initiallyCollapsed} {zen} currentView={$currentView}
  showProjectNavigation={$currentView !== 'global_settings'}
  onNavigate={(view) => currentView.set(view)}
  onSelectProject={(id) => { activeProjectId.set(id); currentView.set('board') }}>
  {#if $currentView === 'global_settings'}
    <ProjectPageHeader title="Global Settings" subtitle="Application preferences shared across projects" />
  {:else}
    <FocusBoard projectId={$activeProjectId} projectName={longContent ? 'OpenForge contributor onboarding across repositories' : (project?.name ?? 'Project')}
      tasks={[createTask({ projectId: $activeProjectId ?? 'P-1', title: 'Review authentication middleware' })]}
      activeSessions={new Map()} ticketPrs={new Map()}
      attentionRows={[{ task_id: 'T-42', project_id: $activeProjectId ?? 'P-1', project_name: project?.name ?? 'Project', title: 'Review authentication middleware', state: 'needs-input', reason: 'Approval needed before continuing.', activity_at: 1767346200, has_unread_agent_output: true }]}
      onOpenTask={() => {}} onRunAction={() => {}} />
  {/if}
  {#if controls}
    <div class="flex shrink-0 gap-2 p-2" aria-label="Story dialog controls">
      <Button size="sm" onclick={shortcuts.open}>Keyboard shortcuts</Button>
      <Button size="sm" variant="ghost" onclick={() => { quitOpen = true }}>Quit application</Button>
    </div>
  {/if}
  {#snippet dialogs()}
    <AppShortcutHelpDialog controller={shortcuts} taskSelected={false} boardVisible={$currentView === 'board'} />
    <AppCloseConfirmationDialog controller={closeController} />
  {/snippet}
  {#snippet overlays()}<ToastHost />{/snippet}
</PageFrame>

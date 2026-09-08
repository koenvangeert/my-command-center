<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import SelfReviewChangedFilesPanel from './SelfReviewChangedFilesPanel.svelte'
  import SelfReviewDiffPanel from './SelfReviewDiffPanel.svelte'
  import SelfReviewRepositoryPreview from './SelfReviewRepositoryPreview.svelte'
  import SelfReviewFeedbackPanel from './SelfReviewFeedbackPanel.svelte'
  import type { SelfReviewWorkspaceController } from './selfReviewWorkspaceController.svelte'
  import type { MarkdownRepositoryLinkTarget } from '@openforge-app/plugin-sdk/markdown'

  interface Props {
    controller: SelfReviewWorkspaceController
    agentStatus: string | null
    onSendToAgent: (prompt: string) => void
    onOpenInFiles: (target: MarkdownRepositoryLinkTarget) => boolean | Promise<boolean>
  }

  let { controller, agentStatus, onSendToAgent, onOpenInFiles }: Props = $props()
  let changedFilesPanel = $state<SelfReviewChangedFilesPanel>()
  let viewport = $state<HTMLDivElement>()
  let files = $state<HTMLDivElement>()
  let code = $state<HTMLDivElement>()
  let feedback = $state<HTMLDivElement>()

  async function showPanel(panel: 'files' | 'code' | 'feedback'): Promise<void> {
    if (panel === 'files') controller.setFileTreeVisible(true)
    if (panel === 'feedback' && !controller.sidebarVisible) controller.toggleSidebar()
    await tick()
    const target = panel === 'files' ? files : panel === 'feedback' ? feedback : code
    if (!target || !viewport) return
    viewport.scrollLeft += target.getBoundingClientRect().left - viewport.getBoundingClientRect().left
  }

  // Start with code in view even when the host also has a project sidebar.
  onMount(() => { void showPanel('code') })
</script>

<div class="flex h-full w-full min-w-0 flex-col overflow-hidden" style="background: var(--of-review-canvas)">
  <div class="flex shrink-0 flex-wrap gap-1 border-b border-base-300 bg-base-100 p-1" role="group" aria-label="Review panels">
    <Button size="sm" variant="ghost" onclick={() => showPanel('files')}>Changed files</Button>
    <Button size="sm" variant="ghost" onclick={() => showPanel('code')}>Code</Button>
    <Button size="sm" variant="ghost" onclick={() => showPanel('feedback')}>
      Feedback ({controller.feedbackPane.totalCommentCount})
    </Button>
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users can scroll the pane row directly.) -->
  <div bind:this={viewport} class="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden" role="region" aria-label="Scrollable review workspace" tabindex="0">
    {#if controller.fileTreeVisible}
      <div bind:this={files} class="h-full shrink-0">
        <SelfReviewChangedFilesPanel
          bind:this={changedFilesPanel}
          pane={controller.changedFilesPane}
        />
      </div>
    {/if}
    <div bind:this={code} class="relative flex min-w-[540px] flex-1 overflow-hidden">
      <SelfReviewDiffPanel
        {controller}
        onRequestFocusFileTree={() => changedFilesPanel?.focusTree()}
      />
      {#if controller.repositoryPreview}
        <SelfReviewRepositoryPreview
          target={controller.repositoryPreview}
          selectedCommitSha={controller.selectedCommitSha}
          fetchContent={controller.fetchRepositoryFile}
          resolveRepositoryImage={controller.resolveRepositoryImage}
          onOpenRepositoryPath={controller.openRepositoryPath}
          {onOpenInFiles}
          onClose={controller.closeRepositoryPreview}
        />
      {/if}
    </div>
    {#if controller.sidebarVisible}
      <div bind:this={feedback} class="h-full shrink-0">
        <SelfReviewFeedbackPanel
          pane={controller.feedbackPane}
          {agentStatus}
          {onSendToAgent}
        />
      </div>
    {/if}
  </div>
</div>

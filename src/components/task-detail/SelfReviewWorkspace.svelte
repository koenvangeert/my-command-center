<script lang="ts">
  import { tick } from 'svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import SendToAgentPanel from './SendToAgentPanel.svelte'
  import SelfReviewSidePanel from './SelfReviewSidePanel.svelte'
  import SelfReviewDiffPanel from './SelfReviewDiffPanel.svelte'
  import SelfReviewRepositoryPreview from './SelfReviewRepositoryPreview.svelte'
  import type { SelfReviewWorkspaceController } from './selfReviewWorkspaceController.svelte'
  import type { MarkdownRepositoryLinkTarget } from '@openforge-app/plugin-sdk/markdown'

  interface Props {
    controller: SelfReviewWorkspaceController
    agentStatus: string | null
    onSendToAgent: (prompt: string) => void
    onOpenInFiles: (target: MarkdownRepositoryLinkTarget) => boolean | Promise<boolean>
  }

  let { controller, agentStatus, onSendToAgent, onOpenInFiles }: Props = $props()
  let sidePanel = $state<SelfReviewSidePanel>()
  let workspaceWidth = $state(0)
  let availablePanelWidth = $derived(workspaceWidth > 0
    ? workspaceWidth < 540 ? workspaceWidth / 2 : workspaceWidth - 300
    : undefined)

  async function focusFileTree(): Promise<void> {
    const taskId = controller.taskId
    controller.setFileTreeVisible(true)
    await tick()
    if (controller.taskId === taskId) sidePanel?.focusTree()
  }
</script>

<div class="flex h-full w-full min-w-0 flex-col overflow-hidden" style="background: var(--of-review-canvas)">
  <div class="flex shrink-0 flex-wrap items-center gap-1 border-b border-base-300 bg-base-100 p-1" role="group" aria-label="Review bar">
    <Button size="sm" variant="ghost" aria-expanded={controller.sidePanelVisible} onclick={controller.toggleSidePanel}>
      {controller.sidePanelVisible ? 'Collapse review panel' : 'Show review panel'}
    </Button>
    {#key controller.taskId}
      <SendToAgentPanel
        {agentStatus}
        {onSendToAgent}
        onRefresh={controller.refresh}
        pendingInlineComments={controller.feedbackPane.composer.pendingInlineComments}
        selectedPrComments={controller.feedbackPane.pullRequest.selection.selectedPrComments}
        onPendingInlineCommentsChange={controller.feedbackPane.composer.onPendingInlineCommentsChange}
        onSendComplete={controller.feedbackPane.composer.onSendComplete}
      />
    {/key}
  </div>
  <div bind:clientWidth={workspaceWidth} class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
    <div class="relative flex min-w-0 flex-1 overflow-hidden">
      <SelfReviewDiffPanel
        {controller}
        onRequestFocusFileTree={focusFileTree}
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
    {#if controller.sidePanelVisible}
      {#key controller.taskId}
        <SelfReviewSidePanel bind:this={sidePanel} {controller} availableWidth={availablePanelWidth} />
      {/key}
    {/if}
  </div>
</div>

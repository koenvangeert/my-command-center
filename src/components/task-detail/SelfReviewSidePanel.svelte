<script lang="ts">
  import Tabs from '@openforge-app/plugin-sdk/ui/Tabs.svelte'
  import ResizablePanel from '@openforge-app/plugin-sdk/ui/ResizablePanel.svelte'
  import SelfReviewChangedFilesPanel from './SelfReviewChangedFilesPanel.svelte'
  import SelfReviewFeedbackPanel from './SelfReviewFeedbackPanel.svelte'
  import type { SelfReviewWorkspaceController } from './selfReviewWorkspaceController.svelte'

  interface Props {
    controller: SelfReviewWorkspaceController
    availableWidth?: number
  }

  let { controller, availableWidth }: Props = $props()
  let changedFilesPanel = $state<SelfReviewChangedFilesPanel>()

  export function focusTree(): void {
    changedFilesPanel?.focusTree()
  }
</script>

<ResizablePanel storageKey="self-review-side-panel" defaultWidth={320} minWidth={240} maxWidth={520} {availableWidth} side="left" label="Review">
  <div class="flex h-full min-w-0 flex-col overflow-hidden border-r border-base-300 bg-base-100">
    <Tabs
      label="Review navigation"
      tabs={[
        { value: 'files', label: 'Changed files' },
        { value: 'github-comments', label: controller.feedbackPane.pullRequest.comments.length
          ? `GitHub comments (${controller.feedbackPane.pullRequest.comments.length})` : 'GitHub comments' },
      ]}
      value={controller.sidePanelTab}
      onValueChange={(value) => controller.selectSidePanelTab(value === 'files' ? 'files' : 'github-comments')}
      fill
      attached
    >
      {#snippet children(value)}
        {#if value === 'files'}
          <SelfReviewChangedFilesPanel bind:this={changedFilesPanel} pane={controller.changedFilesPane} />
        {:else}
          <SelfReviewFeedbackPanel pane={controller.feedbackPane} />
        {/if}
      {/snippet}
    </Tabs>
  </div>
</ResizablePanel>

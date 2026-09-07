<script lang="ts">
  import ResizableBottomPanel from '../../src/components/shared/ui/ResizableBottomPanel.svelte'
  import ProjectPageHeader from '../../src/components/project/ProjectPageHeader.svelte'
  let { fillParent = false }: { fillParent?: boolean } = $props()
</script>

<div style="height: 480px; display: flex; flex-direction: column; justify-content: flex-end">
  <ResizableBottomPanel storageKey="storybook-host-chrome" defaultHeight={220} minHeight={120} maxHeight={400} {fillParent}>
    <ProjectPageHeader title="Project activity" subtitle="Resize the panel to inspect more activity. Double-click the handle to restore its default height." />
  </ResizableBottomPanel>
</div>

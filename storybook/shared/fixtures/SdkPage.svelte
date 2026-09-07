<script lang="ts">
  import { untrack } from 'svelte'
  import PageFrame from '../frames/PageFrame.svelte'
  import PluginPageShell from '@openforge-app/plugin-sdk/ui/PluginPageShell.svelte'
  import PluginPageHeader from '@openforge-app/plugin-sdk/ui/PluginPageHeader.svelte'
  import PluginViewState from '@openforge-app/plugin-sdk/ui/PluginViewState.svelte'
  import CollapsibleSection from '@openforge-app/plugin-sdk/ui/CollapsibleSection.svelte'
  import MarkdownContent from '@openforge-app/plugin-sdk/ui/MarkdownContent.svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'

  let { scenario = 'populated', framed = true }: {
    scenario?: 'populated' | 'loading' | 'empty' | 'error' | 'overflow'
    framed?: boolean
  } = $props()
  let current = $state(untrack(() => scenario))
</script>

{#snippet page()}
  <PluginPageShell>
    {#snippet header()}
      <PluginPageHeader title="Project reports" subtitle="Local reports from your workspace" surface="subtle">
        {#snippet actions()}
          <Button onClick={() => { current = 'populated' }}>Create report</Button>
        {/snippet}
      </PluginPageHeader>
    {/snippet}
    <PluginViewState loading={current === 'loading'} loadingLabel="Reading reports"
      empty={current === 'empty'} emptyTitle="No reports yet" emptyDescription="Create your first local report."
      error={current === 'error' ? 'The report index is unavailable. Your files have not changed.' : null}
      onRetry={() => { current = 'populated' }}>
      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <CollapsibleSection sectionKey="plugin:catalog:report" title="Weekly report">
          <div class="p-4">
            <MarkdownContent content={'## Changes ready for review\n\nThree tasks completed. One needs attention.\n\n' + (current === 'overflow' ? Array.from({ length: 30 }, (_, i) => `- Report entry ${i + 1}: Review the plugin contribution and its documentation.`).join('\n') : '- Updated project documentation\n- Added local report exports')} />
          </div>
        </CollapsibleSection>
      </div>
    </PluginViewState>
  </PluginPageShell>
{/snippet}

{#if framed}
  <PageFrame initiallyCollapsed showProjectNavigation={false}>{@render page()}</PageFrame>
{:else}
  <div class="flex h-screen min-h-0 flex-col">{@render page()}</div>
{/if}

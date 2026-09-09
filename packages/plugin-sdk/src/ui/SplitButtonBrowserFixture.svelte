<script lang="ts">
  import SplitButton from '@openforge-app/plugin-sdk/ui/SplitButton.svelte'
  import AnchoredMenu from '@openforge-app/plugin-sdk/ui/AnchoredMenu.svelte'

  let primaryCount = $state(0)
  let selected = $state('None')
  const items = [
    { value: 'aside', label: 'Set aside' },
    { value: 'disabled', label: 'Unavailable', disabled: true },
    { value: 'long', label: 'A very long action label that must wrap when there is not enough room in the viewport' },
  ]
</script>

<SplitButton menuLabel="More actions" {items} variant="outline" onClick={() => primaryCount++} onSelect={(value) => { selected = value }}>
  {#snippet children()}Complete{/snippet}
  {#snippet item(action)}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    <span>{action.label}</span>
  {/snippet}
</SplitButton>
<AnchoredMenu label="Standalone actions" {items} onSelect={(value) => { selected = value }}>
  {#snippet trigger()}Actions{/snippet}
</AnchoredMenu>
<output aria-label="Primary count">{primaryCount}</output>
<output aria-label="Selected action">{selected}</output>

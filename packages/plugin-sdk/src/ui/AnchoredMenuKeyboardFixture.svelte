<script lang="ts">
  import AnchoredMenu from '@openforge-app/plugin-sdk/ui/AnchoredMenu.svelte'

  let selected = $state('None')
  let selectionCount = $state(0)
  let open = $state(false)
  let remainingItems = $state([
    { value: 'first', label: 'Remove first report', checked: false, closeOnSelect: false },
    { value: 'second', label: 'Remove second report', checked: false, closeOnSelect: false },
    { value: 'third', label: 'Remove third report', checked: false, closeOnSelect: false },
  ])
  const items = [
    { value: 'unavailable', label: 'Unavailable report', disabled: true },
    { value: 'open', label: 'Open report' },
    { value: 'archive', label: 'Archive report', disabled: true },
    { value: 'delete', label: 'Delete report' },
  ]
</script>

<AnchoredMenu label="Report actions" {items} bind:open onSelect={(value) => { selected = value; selectionCount += 1 }}>
  {#snippet trigger()}Actions{/snippet}
</AnchoredMenu>
<output aria-label="Selected action">{selected}</output>
<output aria-label="Selection count">{selectionCount}</output>
<button type="button" onclick={() => (open = true)}>Open actions externally</button>
<AnchoredMenu
  label="Remove reports"
  items={remainingItems}
  onSelect={(value) => { remainingItems = remainingItems.filter((item) => item.value !== value) }}
>
  {#snippet trigger()}Remove reports{/snippet}
</AnchoredMenu>

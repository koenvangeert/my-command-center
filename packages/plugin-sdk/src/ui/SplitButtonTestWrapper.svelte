<script lang="ts">
  import SplitButton from './SplitButton.svelte'

  let { disabled = false, primaryDisabled = false, menuDisabled = false, onClick, onSelect, onOpenChange }: {
    disabled?: boolean
    primaryDisabled?: boolean
    menuDisabled?: boolean
    onClick?: (event: MouseEvent) => void
    onSelect?: (value: string) => void
    onOpenChange?: (open: boolean) => void
  } = $props()
  let open = $state(false)
</script>

<button onclick={() => { open = true }}>Open externally</button>
<SplitButton
  menuLabel="More actions"
  items={[{ value: 'aside', label: 'Set aside' }, { value: 'archive', label: 'Archive', disabled: true }]}
  {disabled}
  {primaryDisabled}
  {menuDisabled}
  {onClick}
  {onSelect}
  {onOpenChange}
  bind:open
>
  Complete
</SplitButton>

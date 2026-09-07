<script lang="ts">
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import ContextMenu from '../../src/components/shared/ui/ContextMenu.svelte'
  import ContextMenuItem from '../../src/components/shared/ui/ContextMenuItem.svelte'

  let { onselect = () => {} }: { onselect?: (value: string) => void } = $props()
  let visible = $state(false)
  let x = $state(24)
  let y = $state(64)
  function select(value: string) { onselect(value); visible = false }
</script>

<Button onclick={(event) => {
  event.stopPropagation()
  const bounds = event.currentTarget.getBoundingClientRect()
  x = bounds.left
  y = bounds.bottom + 8
  visible = true
}}>Open actions</Button>
<ContextMenu {visible} {x} {y} onClose={() => { visible = false }}>
  <ContextMenuItem label="Open project" variant="primary" onclick={() => select('open')} />
  <ContextMenuItem label="Move up" disabled onclick={() => select('move')} />
  <ContextMenuItem label="Copy repository path" description="Copy the full repository path to the clipboard" onclick={() => select('copy')} />
  <ContextMenuItem label="Remove project" variant="danger" onclick={() => select('remove')} />
</ContextMenu>

<script lang="ts">
  import { untrack } from 'svelte'
  import SplitButton from '@openforge-app/plugin-sdk/ui/SplitButton.svelte'
  import { EyeOff } from '@lucide/svelte'

  let { initiallyOpen = false, matrix = false, longLabel = false, onAction = (_value: string) => {} }: {
    initiallyOpen?: boolean
    matrix?: boolean
    longLabel?: boolean
    onAction?: (value: string) => void
  } = $props()
  let open = $state(untrack(() => initiallyOpen))
  let pinned = $state(false)
  const items = $derived([
    { value: 'aside', label: longLabel ? 'Set this report aside until the next scheduled review meeting' : 'Set aside' },
    { value: 'sync', label: 'Sync unavailable', disabled: true },
    { value: 'pin', label: 'Pin report', checked: pinned, closeOnSelect: false },
    { value: 'delete', label: 'Delete report', danger: true },
  ])
  function select(value: string) {
    if (value === 'pin') pinned = !pinned
    onAction(value)
  }
</script>

<section aria-label="Split button examples" class="flex flex-col items-start gap-4 p-6">
  {#if matrix}
    {#each ['primary', 'secondary', 'outline', 'ghost', 'danger', 'error'] as const as variant}
      <div class="flex flex-wrap items-center gap-4">
        {#each ['xs', 'sm', 'md', 'lg'] as const as size}
          <SplitButton {variant} {size} menuLabel={`More ${variant} ${size} actions`} {items} onClick={() => onAction('complete')} onSelect={select}>{variant} {size}</SplitButton>
        {/each}
      </div>
    {/each}
    <SplitButton menuLabel="Disabled actions" {items} disabled>Disabled</SplitButton>
    <SplitButton menuLabel="Actions while completing" {items} primaryDisabled>Completing...</SplitButton>
    <SplitButton menuLabel="Unavailable menu" {items} menuDisabled>Complete</SplitButton>
  {:else}
    <SplitButton variant="outline" menuLabel="More report actions" {items} bind:open onClick={() => onAction('complete')} onSelect={select}>
      {#snippet children()}Complete{/snippet}
      {#snippet item(action)}
        <EyeOff size={16} aria-hidden="true" />
        <span>{action.label}</span>
      {/snippet}
    </SplitButton>
  {/if}
</section>

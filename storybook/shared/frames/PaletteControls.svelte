<script lang="ts">
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import PaletteModal from '../../../src/components/shell/PaletteModal.svelte'
  import PaletteInput from '../../../src/components/shared/ui/PaletteInput.svelte'
  import PaletteListbox from '../../../src/components/shared/ui/PaletteListbox.svelte'
  import PaletteFooter from '../../../src/components/shared/ui/PaletteFooter.svelte'

  let { variant = 'populated', onSelect = () => {}, onClose = () => {} }: {
    variant?: 'populated' | 'empty' | 'loading' | 'overflow'
    onSelect?: (item: string) => void
    onClose?: () => void
  } = $props()
  let open = $state(true)
  let query = $state('')
  let selectedIndex = $state(0)
  let listbox: { handleKeydown: (event: KeyboardEvent) => boolean } | null = $state(null)
  const entries = ['Projects', 'Commands', 'Files']
  let items = $derived(variant === 'empty' ? [] : (variant === 'overflow'
    ? Array.from({ length: 24 }, (_, i) => `Catalog entry ${i + 1}: a long result label`)
    : entries).filter(item => item.toLowerCase().includes(query.toLowerCase())))
  function close() { open = false; onClose() }
  function reopen() { query = ''; selectedIndex = 0; open = true }
</script>

{#if open}
  <PaletteModal ariaLabel="Catalog palette controls" onClose={close} onKeydown={(event) => listbox?.handleKeydown(event) ?? false}>
    <PaletteListbox
      bind:this={listbox} {items} {selectedIndex}
      onSelectedIndexChange={(index) => { selectedIndex = index }}
      onSelect={(item) => { onSelect(item); close() }} onCancel={close}
      getKey={(item) => item} idPrefix="catalog-controls" listboxLabel="Catalog entries"
      loading={variant === 'loading'} listClass="max-h-[300px] overflow-y-auto"
    >
      {#snippet input(listboxId, activeDescendantId)}
        <PaletteInput {listboxId} {activeDescendantId} bind:value={query} placeholder="Filter catalog entries..." onInput={() => { selectedIndex = 0 }} />
      {/snippet}
      {#snippet item(entry)}<span class="block px-4 py-2 text-sm">{entry}</span>{/snippet}
      {#snippet emptyContent()}<p class="p-4 text-sm">No catalog entries</p>{/snippet}
      {#snippet loadingContent()}<p class="p-4 text-sm">Loading catalog entries...</p>{/snippet}
    </PaletteListbox>
    <PaletteFooter actionLabel="select" trailingKey="Ctrl+N/P" />
  </PaletteModal>
{:else}
  <Button onclick={reopen}>Reopen controls</Button>
{/if}

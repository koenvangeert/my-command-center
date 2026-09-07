<script lang="ts">
  import { Plus, RefreshCw, Trash2, LoaderCircle } from '@lucide/svelte'
  import Button from '../../../../packages/plugin-sdk/src/ui/Button.svelte'
  import IconButton from '../../../../packages/plugin-sdk/src/ui/IconButton.svelte'
  import SettingsFrame from '../../../shared/frames/SettingsFrame.svelte'

  let { state = 'default', onAction = () => {} }: {
    state?: 'default' | 'disabled' | 'loading' | 'overflow'
    onAction?: (action: string) => void
  } = $props()
  const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const
  const sizes = ['xs', 'sm', 'md', 'lg'] as const
</script>

<SettingsFrame title="Buttons and icon buttons" description="Production variants and sizes. Busy actions use caller-provided content and native disabled/aria-busy attributes.">
  <div class="space-y-5" data-testid="sdk-actions">
    <div class="flex flex-wrap items-center gap-3">
      <Button disabled={state === 'disabled' || state === 'loading'} aria-busy={state === 'loading'} onClick={() => onAction('create')}>
        {#if state === 'loading'}<LoaderCircle size={16} /> Creating task…{:else}<Plus size={16} /> Create task{/if}
      </Button>
      <IconButton label="Refresh" disabled={state === 'disabled' || state === 'loading'} onClick={() => onAction('refresh')}><RefreshCw size={16} /></IconButton>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      {#each variants as variant}
        <Button {variant} disabled={state === 'disabled'} onClick={() => onAction(variant)}>{variant}</Button>
        <IconButton label={`${variant} action`} {variant} disabled={state === 'disabled'} onClick={() => onAction(variant)}><Trash2 size={16} /></IconButton>
      {/each}
      <Button variant="error" disabled={state === 'disabled'}>Error alias</Button>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      {#each sizes as size}
        <Button {size} disabled={state === 'disabled'}>{size} button</Button>
        <IconButton label={`${size} icon`} {size} disabled={state === 'disabled'}><Plus size={16} /></IconButton>
      {/each}
    </div>
    {#if state === 'overflow'}
      <Button variant="outline">Create a follow-up task for all selected items in this project</Button>
    {/if}
  </div>
</SettingsFrame>

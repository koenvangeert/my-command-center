<script lang="ts">
  import Select from '../../../../packages/plugin-sdk/src/ui/Select.svelte'
  import SearchableSelect from '../../../../packages/plugin-sdk/src/ui/SearchableSelect.svelte'
  import SettingsFrame from '../../../shared/frames/SettingsFrame.svelte'

  let { state = 'default', onValue = () => {}, onOpen = () => {} }: {
    state?: 'default' | 'selected' | 'disabled' | 'error' | 'overflow' | 'empty'
    onValue?: (field: string, value: string) => void
    onOpen?: (open: boolean) => void
  } = $props()
  const providers = [
    { value: 'pi', label: 'Pi' }, { value: 'codex', label: 'Codex' },
    { value: 'unavailable', label: 'Unavailable provider', disabled: true },
  ]
  const projects = [
    { value: 'openforge', label: 'OpenForge', badge: 'Active', badgeVariant: 'success' as const },
    { value: 'website', label: 'Website' },
  ]
  let project = $derived(state === 'selected' ? 'openforge' : '')
  let options = $derived(state === 'empty' ? [] : state === 'overflow' ? [
    ...projects, ...Array.from({ length: 25 }, (_, index) => ({ value: `project-${index}`, label: `Project ${index + 1}: a long descriptive workspace name for overflow inspection` })),
  ] : projects)
</script>

<div class="flex h-screen flex-col">
<SettingsFrame title="Selectors" description="Select supports disabled and validation states. SearchableSelect supports filtering and empty results, but has no disabled, loading, or error props.">
  {#key state}
    <div class="space-y-5" data-testid="sdk-selectors">
      <Select label="Provider" options={state === 'empty' ? [] : state === 'overflow' ? [...providers, ...options] : providers}
        value={state === 'selected' || state === 'disabled' ? 'pi' : ''}
        disabled={state === 'disabled'} error={state === 'error' ? 'Choose an available provider.' : null}
        helperText="Used for new tasks." onValueChange={(value) => onValue('provider', value)} onOpenChange={onOpen} />
      <div class="space-y-2">
        <p>Project</p>
        <SearchableSelect {options} value={project} ariaLabel="Project" placeholder="Choose a project"
          onSelect={(value) => { project = value; onValue('project', value) }} />
      </div>
      <div class="flex flex-wrap gap-3">
        {#each ['xs', 'md'] as size}
          <div class="min-w-0 flex-1">
            <SearchableSelect options={projects} value="openforge" ariaLabel={`${size} project`} size={size as 'xs' | 'md'} onSelect={(value) => onValue(size, value)} />
          </div>
        {/each}
      </div>
    </div>
  {/key}
</SettingsFrame>
</div>

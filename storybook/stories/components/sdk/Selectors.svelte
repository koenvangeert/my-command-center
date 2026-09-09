<script lang="ts">
  import Select from '../../../../packages/plugin-sdk/src/ui/Select.svelte'
  import SearchableSelect from '../../../../packages/plugin-sdk/src/ui/SearchableSelect.svelte'
  import SettingsFrame from '../../../shared/frames/SettingsFrame.svelte'

  let { state = 'default', onValue = () => {}, onOpen = () => {} }: {
    state?: 'default' | 'selected' | 'disabled' | 'error' | 'overflow' | 'empty' | 'large'
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
  let project = $derived(state === 'large' ? 'project-5000' : state === 'selected' ? 'openforge' : '')
  let options = $derived(state === 'large' ? Array.from({ length: 5000 }, (_, index) => ({
    value: `project-${index + 1}`, label: `Workspace ${index + 1}`, keywords: [`P-${index + 1}`],
  })) : state === 'empty' ? [] : state === 'overflow' ? [
    ...projects, ...Array.from({ length: 25 }, (_, index) => ({ value: `project-${index}`, label: `Project ${index + 1}: a long descriptive workspace name for overflow inspection` })),
  ] : projects)
</script>

<div class="flex h-screen flex-col">
<SettingsFrame title="Selectors" description="Select supports disabled options and validation. SearchableSelect supports disabled state, keyword search, bounded results, and result counts.">
  {#key state}
    <div class="space-y-5" data-testid="sdk-selectors">
      <Select label="Provider" options={state === 'empty' ? [] : state === 'overflow' ? [...providers, ...options] : providers}
        value={state === 'selected' || state === 'disabled' ? 'pi' : ''}
        disabled={state === 'disabled'} error={state === 'error' ? 'Choose an available provider.' : null}
        helperText="Used for new tasks." onValueChange={(value) => onValue('provider', value)} onOpenChange={onOpen} />
      <div class="space-y-2">
        <p>Project</p>
        <SearchableSelect {options} value={project} ariaLabel="Project" placeholder="Choose a project"
          disabled={state === 'disabled'}
          maxResults={state === 'large' ? 40 : undefined}
          onSelect={(value) => { project = value; onValue('project', value) }} />
      </div>
      <div class="flex flex-wrap gap-3">
        {#each ['xs', 'md'] as size}
          <div class="min-w-0 flex-1">
            <SearchableSelect options={projects} value="openforge" ariaLabel={`${size} project`} size={size as 'xs' | 'md'} disabled={state === 'disabled'} onSelect={(value) => onValue(size, value)} />
          </div>
        {/each}
      </div>
    </div>
  {/key}
</SettingsFrame>
</div>

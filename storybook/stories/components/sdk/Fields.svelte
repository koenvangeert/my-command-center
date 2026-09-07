<script lang="ts">
  import { Search, Folder } from '@lucide/svelte'
  import TextField from '../../../../packages/plugin-sdk/src/ui/TextField.svelte'
  import Textarea from '../../../../packages/plugin-sdk/src/ui/Textarea.svelte'
  import Checkbox from '../../../../packages/plugin-sdk/src/ui/Checkbox.svelte'
  import Switch from '../../../../packages/plugin-sdk/src/ui/Switch.svelte'
  import SettingsFrame from '../../../shared/frames/SettingsFrame.svelte'

  let { state = 'default', onValue = () => {} }: {
    state?: 'default' | 'selected' | 'disabled' | 'error' | 'overflow'
    onValue?: (field: string, value: string | boolean) => void
  } = $props()
  let disabled = $derived(state === 'disabled')
  let selected = $derived(state === 'selected' || disabled)
  let invalid = $derived(state === 'error')
</script>

<SettingsFrame title="Form inputs" description="Labels, descriptions, validation, selection, and native disabled states.">
  {#key state}
    <div class="space-y-4" data-testid="sdk-fields">
      <TextField label="Project name" value={selected ? 'OpenForge' : ''} placeholder="Project name" {disabled}
        helperText="Shown in the project switcher." error={invalid ? 'Enter a project name.' : null}
        onValueChange={(value) => onValue('name', value)} />
      <TextField label="Search files" size="sm" value={state === 'overflow' ? '/workspace/projects/a-very-long-project-name/src/components/settings/ProjectSettings.svelte' : ''}
        placeholder="Search files…" {disabled} onValueChange={(value) => onValue('search', value)}>
        {#snippet leading()}<Search size={14} />{/snippet}
        {#snippet trailing()}<Folder size={14} />{/snippet}
      </TextField>
      <Textarea label="Instructions" rows={3} value={selected ? 'Run the focused tests before committing.' : state === 'overflow' ? 'Keep the current task focused. '.repeat(30) : ''}
        {disabled} helperText="Describe what the agent should do." error={invalid ? 'Instructions are required.' : null}
        onValueChange={(value) => onValue('instructions', value)} />
      <label class="flex items-center gap-2"><Checkbox checked={selected} {disabled} onCheckedChange={(value) => onValue('archived', value)} />Include archived tasks</label>
      <div class="flex flex-wrap gap-4">
        {#each ['xs', 'sm', 'md'] as size}
          <label class="flex items-center gap-2"><Checkbox size={size as 'xs' | 'sm' | 'md'} indeterminate {disabled} />{size} mixed selection</label>
        {/each}
      </div>
      <Switch label="Enable notifications" checked={selected} {disabled} error={invalid ? 'Notifications must be enabled to continue.' : null}
        onCheckedChange={(value) => onValue('notifications', value)} />
    </div>
  {/key}
</SettingsFrame>

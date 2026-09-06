<script lang="ts">
  import { Folder } from '@lucide/svelte'
  import PluginSidebarLink from '../../../../packages/plugin-sdk/src/ui/PluginSidebarLink.svelte'
  import Badge from '../../../../packages/plugin-sdk/src/ui/Badge.svelte'
  import SettingsFrame from '../../../shared/frames/SettingsFrame.svelte'

  let { state = 'default', onActivate = () => {} }: {
    state?: 'default' | 'selected' | 'collapsed' | 'overflow'
    onActivate?: () => void
  } = $props()
</script>

<SettingsFrame title="Sidebar contribution" description="Expanded and collapsed labels, current-page indication, and optional leading/trailing content.">
  <nav aria-label="Plugin navigation" class="max-w-full" style:width={state === 'collapsed' ? '56px' : '240px'} data-testid="sdk-navigation">
    <PluginSidebarLink accessibleName="Project files" active={state !== 'default'} collapsed={state === 'collapsed'} {onActivate}>
      {#snippet leading()}<Folder size={18} />{/snippet}
      {#snippet label()}{state === 'overflow' ? 'Project files with a long contribution name' : 'Project files'}{/snippet}
      {#snippet trailing()}<Badge variant="info">12</Badge>{/snippet}
    </PluginSidebarLink>
  </nav>
</SettingsFrame>

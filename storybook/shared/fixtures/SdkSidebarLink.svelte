<script lang="ts">
  import { untrack } from 'svelte'
  import PluginSidebarLink from '@openforge-app/plugin-sdk/ui/PluginSidebarLink.svelte'
  let { active = false, collapsed = false }: { active?: boolean; collapsed?: boolean } = $props()
  let selected = $state(untrack(() => active))
</script>

<nav aria-label="Plugin navigation">
  <PluginSidebarLink accessibleName="Project reports" active={selected} {collapsed} onActivate={() => { selected = true }}>
    {#snippet leading()}<span aria-hidden="true">R</span>{/snippet}
    {#snippet label()}Project reports{/snippet}
    {#snippet trailing()}<span>3</span>{/snippet}
  </PluginSidebarLink>
</nav>

<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import CompanionPairedDevices from '../../../src/components/settings/CompanionPairedDevices.svelte'
  import SettingsFrame from './SettingsFrame.svelte'
  let props: ComponentProps<typeof CompanionPairedDevices> = $props()
</script>

<SettingsFrame title="Companion" description="Paired device access">
  <CompanionPairedDevices {...props} />
</SettingsFrame>

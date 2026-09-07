<script lang="ts">
  import SettingsView from '../../../src/components/settings/SettingsView.svelte'
  import PageFrame from './PageFrame.svelte'

  let { mode, onClose = () => {}, onProjectDeleted = () => {} }: {
    mode: 'project' | 'global'
    onClose?: () => void
    onProjectDeleted?: () => void
  } = $props()
</script>

<PageFrame currentView={mode === 'project' ? 'settings' : 'global_settings'} showProjectNavigation={mode === 'project'}>
  <SettingsView {mode} {onClose} {onProjectDeleted} />
</PageFrame>

<script lang="ts">
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import TextField from '@openforge-app/plugin-sdk/ui/TextField.svelte'
  import Switch from '@openforge-app/plugin-sdk/ui/Switch.svelte'
  import Badge from '@openforge-app/plugin-sdk/ui/Badge.svelte'
  import PluginViewState from '@openforge-app/plugin-sdk/ui/PluginViewState.svelte'
</script>

<main aria-label="Token-only SDK baseline">
  <section aria-label="SDK controls">
    <Button data-testid="sdk-action">Run review</Button>
    <Button data-testid="sdk-disabled" disabled>Unavailable action</Button>
    <TextField label="Invalid repository" value="invalid repository" invalid />
    <Switch label="Selected setting" checked />
    <Badge variant="success" role="status">Ready</Badge>
  </section>
  <section aria-label="SDK loading feedback">
    <PluginViewState loading loadingLabel="Reading reports" />
  </section>
  <section aria-label="SDK error feedback">
    <PluginViewState error="Report index unavailable" onRetry={() => {}} />
  </section>
</main>

<style>
  main {
    color: var(--of-text);
    background: var(--of-surface);
    font-family: var(--of-font-sans);
    padding: var(--of-space4);
  }
  section {
    display: grid;
    gap: var(--of-space3);
    margin-bottom: var(--of-space4);
  }
</style>

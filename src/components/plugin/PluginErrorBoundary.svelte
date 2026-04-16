<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    pluginId: string
    pluginName: string
    children: Snippet
    onDisable?: () => void
  }

  const props: Props = $props()

  let hasError = $state(false)
  let errorMessage = $state('')

  void props
  void hasError
  void errorMessage

  export const setError = (message: string): void => {
    hasError = true
    errorMessage = message
  }

  export const clearError = (): void => {
    hasError = false
    errorMessage = ''
  }
</script>

{#if hasError}
  <div class="rounded-lg border border-error/20 bg-error/10 p-4" role="alert" data-plugin-id={props.pluginId}>
    <p class="text-sm font-medium text-error">Plugin Error: {props.pluginName}</p>
    <p class="mt-1 text-xs text-error/70">{errorMessage}</p>
    {#if props.onDisable}
      <button class="btn btn-error btn-outline btn-xs mt-2" onclick={props.onDisable}>
        Disable Plugin
      </button>
    {/if}
  </div>
{:else}
  {@render props.children()}
{/if}

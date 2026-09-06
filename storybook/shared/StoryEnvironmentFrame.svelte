<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { StoryScenario } from './storyEnvironmentPreview'
  import StoryTerminalFrame from './StoryTerminalFrame.svelte'

  let { scenario, children }: { scenario: StoryScenario; children: Snippet } = $props()
</script>

{#key scenario}
  {#if scenario.terminal}
    <StoryTerminalFrame terminal={scenario.terminal} {children} />
  {:else}
    {@render children()}
  {/if}
{/key}

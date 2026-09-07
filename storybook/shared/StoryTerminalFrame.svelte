<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import type { StoryTerminalAdapter } from './environment/storyTerminalAdapter'

  let { terminal, children }: { terminal: StoryTerminalAdapter; children: Snippet } = $props()
  let visible = $state(true)

  // Storybook runs environment disposal before destroying the old story tree.
  // Hide its production views first so their cleanup still uses their own runtime.
  onMount(() => terminal.registerView({
    async unmount() {
      visible = false
      await tick()
    },
    async remount() {
      visible = true
      await tick()
    },
  }))
</script>

{#if visible}
  <div class="h-screen w-full min-h-0 overflow-hidden">
    {@render children()}
  </div>
{/if}

<script lang="ts">
  import type { Snippet } from 'svelte'
  let { children }: { children: Snippet } = $props()
</script>

<div class="flex h-screen min-h-0 w-full flex-col overflow-hidden">
  {@render children()}
</div>

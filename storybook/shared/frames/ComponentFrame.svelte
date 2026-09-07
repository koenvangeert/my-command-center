<script lang="ts">
  import type { Snippet } from 'svelte'
  let { children }: { children: Snippet } = $props()
</script>

<div class="h-screen min-h-0 min-w-0 overflow-auto bg-base-100 text-base-content">
  {@render children()}
</div>

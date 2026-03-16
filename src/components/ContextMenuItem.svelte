<script lang="ts">
  interface Props {
    label: string
    onclick: (e: MouseEvent) => void
    variant?: 'default' | 'primary' | 'danger'
    description?: string
  }

  let { label, onclick, variant = 'default', description }: Props = $props()

  let variantClasses = $derived(
    variant === 'primary'
      ? 'text-primary font-medium hover:bg-primary hover:text-primary-content'
      : variant === 'danger'
        ? 'text-error hover:bg-error hover:text-error-content'
        : 'text-base-content hover:bg-primary hover:text-primary-content'
  )
</script>

<button
  class="context-item block w-full text-left px-3 py-2 text-sm cursor-pointer rounded {variantClasses}"
  {onclick}
  role="menuitem"
>
  {label}
  {#if description}
    <span class="block text-xs opacity-50 truncate max-w-[250px]">{description}</span>
  {/if}
</button>

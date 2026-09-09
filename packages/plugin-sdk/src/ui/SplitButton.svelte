<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte'
  import Button from './Button.svelte'
  import AnchoredMenu, { type AnchoredMenuItem, type AnchoredMenuSide, type AnchoredMenuAlign } from './AnchoredMenu.svelte'

  interface Props {
    children: Snippet
    menuLabel: string
    items: readonly AnchoredMenuItem[]
    variant?: ComponentProps<typeof Button>['variant']
    size?: ComponentProps<typeof Button>['size']
    disabled?: boolean
    primaryDisabled?: boolean
    menuDisabled?: boolean
    open?: boolean
    side?: AnchoredMenuSide
    align?: AnchoredMenuAlign
    sideOffset?: number
    class?: string
    onClick?: (event: MouseEvent) => void
    onSelect?: (value: string) => void
    onOpenChange?: (open: boolean) => void
    item?: Snippet<[AnchoredMenuItem]>
  }

  let {
    children, menuLabel, items, variant = 'primary', size = 'md',
    disabled = false, primaryDisabled = false, menuDisabled = false,
    open = $bindable(false), side = 'bottom', align = 'end', sideOffset = 4,
    class: className, onClick, onSelect, onOpenChange, item,
  }: Props = $props()
</script>

<div class="of-split-button {className ?? ''}">
  <Button type="button" {variant} {size} disabled={disabled || primaryDisabled} {onClick}>
    {@render children()}
  </Button>
  <AnchoredMenu
    label={menuLabel}
    {items}
    disabled={disabled || menuDisabled}
    triggerButton={{ variant, size }}
    bind:open
    {side}
    {align}
    {sideOffset}
    {onSelect}
    {onOpenChange}
    {item}
  >
    {#snippet trigger()}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="disclosure" class:disclosure-open={open} aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    {/snippet}
  </AnchoredMenu>
</div>

<style>
  .of-split-button {
    display: inline-flex;
    align-items: stretch;
    flex-shrink: 0;
  }

  .of-split-button > :global(button) {
    border-radius: var(--of-radius-control) 0 0 var(--of-radius-control);
  }

  .of-split-button :global(.of-menu-button-trigger) {
    padding-inline: var(--of-space2);
    margin-left: calc(-1 * var(--of-border-width));
    border-radius: 0 var(--of-radius-control) var(--of-radius-control) 0;
    border-left-color: var(--of-border-interactive);
  }

  .of-split-button :global(button:focus-visible) {
    position: relative;
    z-index: 1;
  }

  .disclosure {
    flex-shrink: 0;
    transition: transform var(--of-duration-standard) var(--of-ease-standard);
  }

  .disclosure-open {
    transform: rotate(180deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .disclosure {
      transition: none;
    }
  }
</style>

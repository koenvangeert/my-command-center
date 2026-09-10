<script lang="ts">
  import { tick } from 'svelte'
  import Badge from './Badge.svelte'

  type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

  interface Option {
    value: string
    label: string
    /** Additional searchable text, such as project IDs. Never displayed. */
    keywords?: string[]
    badge?: string
    badgeVariant?: BadgeVariant
  }

  interface Props {
    options: Option[]
    value: string
    placeholder?: string
    size?: 'xs' | 'sm' | 'md'
    ariaLabel?: string
    /** Maximum rendered matches. Omit for unlimited results. */
    maxResults?: number
    disabled?: boolean
    onSelect: (value: string) => void
  }

  let { options, value, placeholder = 'Search...', size = 'sm', ariaLabel, maxResults, disabled = false, onSelect }: Props = $props()

  let query = $state('')
  let open = $state(false)
  let highlightedIndex = $state(0)
  let inputEl = $state<HTMLInputElement | null>(null)
  let triggerEl = $state<HTMLDivElement | null>(null)
  let listEl = $state<HTMLUListElement | null>(null)
  const listboxId = `searchable-select-listbox-${Math.random().toString(36).slice(2)}`

  let selectedOption = $derived(options.find(o => o.value === value) ?? null)
  let selectedLabel = $derived(selectedOption?.label ?? '')

  let matches = $derived.by(() => {
    const q = query.toLowerCase().trim()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q)
      || o.keywords?.some(keyword => keyword.toLowerCase().includes(q)))
  })
  let resultLimit = $derived(maxResults === undefined
    ? Infinity
    : Number.isFinite(maxResults) ? Math.max(1, Math.floor(maxResults)) : 1)
  let filtered = $derived(matches.slice(0, resultLimit))

  $effect(() => {
    filtered
    highlightedIndex = 0
  })

  $effect(() => {
    if (open && listEl) {
      const element = listEl.children.item(highlightedIndex)
      if (element instanceof HTMLElement) {
        element.scrollIntoView?.({ block: 'nearest' })
      }
    }
  })

  $effect(() => {
    if (disabled) closeDropdown()
  })

  function openDropdown() {
    if (disabled) return
    query = ''
    open = true
    highlightedIndex = 0
    tick().then(() => inputEl?.focus())
  }

  function closeDropdown(restoreFocus = false) {
    open = false
    query = ''
    if (restoreFocus && !disabled) triggerEl?.focus()
  }

  function selectOption(option: Option) {
    if (disabled) return
    onSelect(option.value)
    closeDropdown(true)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled || !open) return

    if (event.key === 'ArrowDown' || (event.ctrlKey && (event.key === 'j' || event.key === 'n'))) {
      event.preventDefault()
      event.stopPropagation()
      highlightedIndex = Math.max(0, Math.min(highlightedIndex + 1, filtered.length - 1))
      return
    }

    if (event.key === 'ArrowUp' || (event.ctrlKey && (event.key === 'k' || event.key === 'p'))) {
      event.preventDefault()
      event.stopPropagation()
      highlightedIndex = Math.max(highlightedIndex - 1, 0)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const option = filtered[highlightedIndex]
      if (option) selectOption(option)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeDropdown(true)
    }
  }
</script>

<div
  class="searchable-select"
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeDropdown()
  }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={triggerEl}
    class="searchable-select-trigger"
    data-size={size}
    onclick={openDropdown}
    onkeydown={(event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        openDropdown()
      }
    }}
    role="combobox"
    aria-label={ariaLabel}
    aria-controls={listboxId}
    aria-expanded={open}
    aria-disabled={disabled}
    tabindex={disabled ? -1 : 0}
  >
    <span class="searchable-select-value">
      <span class="searchable-select-label">{selectedLabel || placeholder}</span>
      {#if selectedOption?.badge}
        <span class="searchable-select-badge"><Badge variant={selectedOption.badgeVariant ?? 'neutral'}>{selectedOption.badge}</Badge></span>
      {/if}
    </span>
  </div>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div role="presentation" class="searchable-select-dismiss" onclick={() => closeDropdown()}></div>
    <div class="searchable-select-popover">
      <div class="searchable-select-search">
        <input
          bind:this={inputEl}
          type="text"
          class="searchable-select-input"
          aria-label="Search options"
          aria-controls={listboxId}
          aria-describedby={`${listboxId}-count`}
          aria-autocomplete="list"
          aria-activedescendant={filtered[highlightedIndex] ? `${listboxId}-option-${highlightedIndex}` : undefined}
          placeholder="Search..."
          bind:value={query}
          onkeydown={handleKeydown}
        />
      </div>
      <ul
        id={listboxId}
        bind:this={listEl}
        class="searchable-select-list"
        role="listbox"
        aria-label={ariaLabel ?? 'Options'}
      >
        {#each filtered as option, index (option.value)}
          <li
            role="option"
            id={`${listboxId}-option-${index}`}
            aria-selected={option.value === value}
            data-highlighted={index === highlightedIndex ? '' : undefined}
            data-current={option.value === value && index !== highlightedIndex ? '' : undefined}
            tabindex="-1"
            class="searchable-select-option"
            onclick={() => selectOption(option)}
            onkeydown={(event: KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                selectOption(option)
              }
            }}
            onmouseenter={() => { highlightedIndex = index }}
          >
            <span class="searchable-select-value searchable-select-option-value">
              <span class="searchable-select-label">{option.label}</span>
              {#if option.badge}
                <span class="searchable-select-badge"><Badge variant={option.badgeVariant ?? 'neutral'}>{option.badge}</Badge></span>
              {/if}
            </span>
          </li>
        {:else}
          <li class="searchable-select-empty">No matches</li>
        {/each}
      </ul>
      <div id={`${listboxId}-count`} role="status" aria-live="polite" aria-atomic="true" class="searchable-select-count">
        {#if filtered.length < matches.length}
          Showing {filtered.length} of {matches.length} results. Refine your search.
        {:else}
          {matches.length} {matches.length === 1 ? 'result' : 'results'}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .searchable-select-dismiss {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .searchable-select-list {
    box-sizing: border-box;
    max-height: 200px;
    overflow-y: auto;
    margin: 0;
    padding: var(--of-space2) 0;
    list-style: none;
  }

  .searchable-select-value {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--of-space4);
  }

  .searchable-select-option-value {
    justify-content: space-between;
  }

  .searchable-select-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .searchable-select-badge {
    display: inline-flex;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .searchable-select-empty {
    padding: var(--of-space4) var(--of-space5);
    color: var(--of-text-muted);
    font-size: var(--of-text-sm);
    line-height: calc(4 / 3);
  }

  .searchable-select {
    position: relative;
  }

  .searchable-select-trigger,
  .searchable-select-input {
    box-sizing: border-box;
    width: 100%;
    border: var(--of-border-width) solid var(--of-border-interactive);
    border-radius: var(--of-radius-control);
    background: var(--of-field);
    color: var(--of-text);
    font-family: var(--of-font-sans);
    font-size: var(--of-text-sm);
  }

  .searchable-select-trigger {
    display: flex;
    min-height: var(--of-control-height);
    align-items: center;
    padding-inline: var(--of-space3);
    cursor: pointer;
  }

  .searchable-select-trigger[aria-disabled='true'] {
    color: var(--of-control-text-disabled);
    cursor: not-allowed;
    background: var(--of-control-disabled);
  }

  .searchable-select-trigger[data-size='xs'],
  .searchable-select-trigger[data-size='sm'] {
    min-height: var(--of-control-height-compact);
    font-size: var(--of-text-xs);
  }

  .searchable-select-trigger:hover:not([aria-disabled='true']),
  .searchable-select-input:hover {
    background: var(--of-field-hover);
  }

  .searchable-select-trigger:focus-visible,
  .searchable-select-input:focus-visible {
    outline: var(--of-focus-width) solid var(--of-focus-ring);
    outline-offset: var(--of-space1);
  }

  .searchable-select-popover {
    position: absolute;
    z-index: 50;
    top: calc(100% + var(--of-space1));
    right: 0;
    left: 0;
    overflow: hidden;
    border: var(--of-border-width) solid var(--of-border-strong);
    border-radius: var(--of-radius-overlay);
    background: var(--of-surface-raised);
    color: var(--of-text);
    box-shadow: var(--of-shadow-raised);
  }

  .searchable-select-search {
    padding: var(--of-space2);
    border-bottom: var(--of-border-width) solid var(--of-border);
  }

  .searchable-select-input {
    min-height: var(--of-control-height-compact);
    padding-inline: var(--of-space3);
  }

  .searchable-select-count {
    padding: var(--of-space2) var(--of-space3);
    color: var(--of-text-muted);
    font-size: var(--of-text-xs);
  }

  .searchable-select-option {
    padding: var(--of-space2) var(--of-space3);
    color: var(--of-text);
    font-size: var(--of-text-sm);
    cursor: pointer;
    transition:
      background-color var(--of-duration-fast) var(--of-ease-standard),
      color var(--of-duration-fast) var(--of-ease-standard);
  }

  .searchable-select-option[data-highlighted] {
    background: var(--of-accent);
    color: var(--of-on-accent);
  }

  .searchable-select-option[data-current] {
    color: var(--of-accent);
    font-weight: var(--of-weight-medium);
  }

  @media (prefers-reduced-motion: reduce) {
    .searchable-select-option {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import type { AutocompleteItem } from './AutocompletePopover.svelte'
  import AutocompletePopover from './AutocompletePopover.svelte'
  import VoiceInput from './VoiceInput.svelte'
  import ModelDownloadProgress from './ModelDownloadProgress.svelte'
  import { useAutocomplete } from '../lib/useAutocomplete.svelte'

  interface Props {
    value?: string
    jiraKey?: string
    placeholder?: string
    projectId: string
    onSubmit: (prompt: string, jiraKey: string | null) => void
    onCancel: () => void
    autofocus?: boolean
  }

  let {
    value = '',
    jiraKey: initialJiraKey = '',
    placeholder = 'Describe what you want to implement...',
    projectId,
    onSubmit,
    onCancel,
    autofocus = false
  }: Props = $props()

  // ── Local state ──────────────────────────────────────────────────────────────
  let textValue = $state(value)
  let jiraKeyValue = $state(initialJiraKey)
  let showJiraKey = $state(!!initialJiraKey)
  let showModelDownload = $state(false)

  let textareaEl = $state<HTMLTextAreaElement | null>(null)

  // ── Autocomplete composable ───────────────────────────────────────────────────
  const ac = useAutocomplete(projectId)

  // ── Auto-focus ───────────────────────────────────────────────────────────────
  $effect(() => {
    if (textareaEl && autofocus) {
      textareaEl.focus()
    }
  })

  // ── Transcription ────────────────────────────────────────────────────────────
  function handleTranscription(text: string) {
    if (!textareaEl) return
    const cursorPos = textareaEl.selectionStart ?? textValue.length
    const before = textValue.slice(0, cursorPos)
    const after = textValue.slice(cursorPos)
    const separator = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
    textValue = before + separator + text + after
    const newPos = cursorPos + separator.length + text.length
    setTimeout(() => {
      textareaEl?.setSelectionRange(newPos, newPos)
      autoGrow()
    }, 0)
  }

  // ── Auto-grow ────────────────────────────────────────────────────────────────
  function autoGrow() {
    if (!textareaEl) return
    textareaEl.style.height = 'auto'
    textareaEl.style.height = textareaEl.scrollHeight + 'px'
  }

  // ── Input handler ────────────────────────────────────────────────────────────
  async function handleInput() {
    autoGrow()
    if (!textareaEl) return
    const text = textareaEl.value
    const cursorPos = textareaEl.selectionStart ?? text.length
    await ac.handleTriggerDetection(text, cursorPos)
  }

  // ── Item selection ────────────────────────────────────────────────────────────
  function handleSelect(item: AutocompleteItem) {
    if (!textareaEl) return

    if (ac.activeTrigger === 'slash') {
      // Replace entire input with /command + trailing space
      textValue = `/${item.label} `
    } else if (ac.activeTrigger === 'at') {
      const text = textareaEl.value
      const cursorPos = textareaEl.selectionStart ?? text.length
      const textBeforeCursor = text.slice(0, cursorPos)
      const atMatch = textBeforeCursor.match(/(^|[\s\n])@(\S*)$/)

      if (atMatch) {
        const atIndex = textBeforeCursor.lastIndexOf('@')
        const beforeAt = text.slice(0, atIndex)
        const afterCursor = text.slice(cursorPos)
        textValue = `${beforeAt}@${item.label}${afterCursor}`

        // Move cursor to just after the inserted label
        const newCursorPos = atIndex + 1 + item.label.length
        setTimeout(() => {
          textareaEl?.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
      }
    }

    ac.closePopover()
    // Let the DOM update, then auto-grow
    setTimeout(() => autoGrow(), 0)
    textareaEl.focus()
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (ac.popoverVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        ac.setSelectedIndex(Math.min(ac.selectedIndex + 1, ac.autocompleteItems.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        ac.setSelectedIndex(Math.max(ac.selectedIndex - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = ac.autocompleteItems[ac.selectedIndex]
        if (item) handleSelect(item)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        ac.closePopover()
        return
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  // ── Jira key extraction ─────────────────────────────────────────────────────
  function extractJiraKey(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    // Match a Jira URL like https://mycompany.atlassian.net/browse/PROJ-123
    const urlMatch = trimmed.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/i)
    if (urlMatch) return urlMatch[1].toUpperCase()
    // Already a bare key like PROJ-123
    const keyMatch = trimmed.match(/^([A-Z][A-Z0-9_]+-\d+)$/i)
    if (keyMatch) return keyMatch[1].toUpperCase()
    // Return as-is if it doesn't match known patterns
    return trimmed
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmit() {
    const prompt = textValue.trim()
    if (!prompt) return
    onSubmit(prompt, extractJiraKey(jiraKeyValue))
  }
</script>

<div>
  <div class="bg-base-100 border border-base-300 rounded-lg">
    <div class="relative">
      <textarea
        bind:this={textareaEl}
        bind:value={textValue}
        class="w-full resize-none bg-transparent border-none outline-none p-3 text-sm"
        rows={2}
        {placeholder}
        style="max-height: 15rem; overflow-y: auto;"
        oninput={handleInput}
        onkeydown={handleKeydown}
      ></textarea>

      <AutocompletePopover
        items={ac.autocompleteItems}
        visible={ac.popoverVisible}
        selectedIndex={ac.selectedIndex}
        onSelect={handleSelect}
        onClose={ac.closePopover}
      />
    </div>

    <!-- Voice input inside the bordered area -->
    <div class="flex items-center px-3 pb-2">
      <VoiceInput onTranscription={handleTranscription} listenToHotkey />
    </div>
  </div>

  <!-- Jira Key row (outside border) -->
  <div class="pt-2">
    {#if showJiraKey}
      <label class="flex flex-col gap-1.5">
        <span class="text-xs text-base-content/60 font-medium">Jira Key</span>
        <div class="flex items-center gap-2">
          <input
            type="text"
            class="input input-bordered input-sm flex-1"
            bind:value={jiraKeyValue}
            placeholder="e.g. PROJ-123 or Jira link"
          />
          <span
            class="text-xs text-base-content/40 cursor-pointer hover:text-base-content/60"
            role="button"
            tabindex="0"
            onclick={() => { showJiraKey = false; jiraKeyValue = '' }}
            onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && (showJiraKey = false) && (jiraKeyValue = '')}
          >✕</span>
        </div>
      </label>
    {:else}
      <span
        class="text-xs text-primary cursor-pointer hover:underline"
        role="button"
        tabindex="0"
        onclick={() => { showJiraKey = true }}
        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') showJiraKey = true }}
      >+ Add JIRA key or link</span>
    {/if}
  </div>

  <!-- Footer with submit (outside border) -->
  <div class="flex items-center justify-end gap-2 pt-2">
    <span class="text-xs text-base-content/40">⌘Enter to submit · Enter for newline</span>
    <button
      class="btn btn-primary btn-sm"
      type="button"
      disabled={!textValue.trim()}
      onclick={handleSubmit}
    >Submit</button>
  </div>

  {#if showModelDownload}
    <div class="pt-2">
      <ModelDownloadProgress
        onComplete={() => { showModelDownload = false }}
        onError={() => { showModelDownload = false }}
      />
    </div>
  {/if}
</div>

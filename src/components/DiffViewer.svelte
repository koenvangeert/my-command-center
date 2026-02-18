<script lang="ts">
  import { onMount } from 'svelte'
  import { html as diff2htmlHtml } from 'diff2html'
  import { ColorSchemeType } from 'diff2html/lib/types'
  import 'diff2html/bundles/css/diff2html.min.css'
  import type { PrFileDiff } from '../lib/types'

  export let files: PrFileDiff[] = []

  let container: HTMLElement
  let outputFormat: 'side-by-side' | 'line-by-line' = 'side-by-side'

  $: if (container && files.length > 0) {
    renderDiffs()
  }

  function renderDiffs() {
    if (!container) return

    const diffStrings = files
      .filter(f => f.patch)
      .map(f => {
        const header = `--- a/${f.filename}\n+++ b/${f.filename}\n`
        return header + f.patch
      })

    const fullDiff = diffStrings.join('\n')

    if (!fullDiff.trim()) {
      container.innerHTML = '<div class="no-diff">No diff data available</div>'
      return
    }

    try {
      const html = diff2htmlHtml(fullDiff, {
        drawFileList: false,
        outputFormat,
        matching: 'lines',
        colorScheme: ColorSchemeType.DARK,
      })
      container.innerHTML = html
    } catch (e) {
      console.error('Failed to render diff:', e)
      container.innerHTML = '<div class="error">Failed to render diff</div>'
    }
  }

  export function scrollToFile(filename: string) {
    if (!container) return
    const fileHeaders = container.querySelectorAll('.d2h-file-name')
    for (const header of fileHeaders) {
      const text = header.textContent?.trim() ?? ''
      if (text === filename || text.endsWith('/' + filename) || filename.endsWith(text)) {
        const wrapper = header.closest('.d2h-file-wrapper')
        if (wrapper) {
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }
    }
  }

  onMount(() => {
    if (files.length > 0) {
      renderDiffs()
    }
  })
</script>

<div class="diff-viewer">
  <div class="controls">
    <button class:active={outputFormat === 'side-by-side'} on:click={() => outputFormat = 'side-by-side'}>
      Split
    </button>
    <button class:active={outputFormat === 'line-by-line'} on:click={() => outputFormat = 'line-by-line'}>
      Unified
    </button>
  </div>
  
  <div class="diff-container" bind:this={container}>
    {#if files.length === 0}
      <div class="empty">No files to display</div>
    {/if}
  </div>
</div>

<style>
  .diff-viewer {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  .controls {
    display: flex;
    gap: 4px;
    padding: 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .controls button {
    all: unset;
    padding: 6px 12px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .controls button:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .controls button.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(122, 162, 247, 0.1);
  }

  .diff-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg-primary);
  }

  .empty,
  .no-diff,
  .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .error {
    color: var(--error);
  }

  :global(.d2h-wrapper) {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', monospace;
    font-size: 12px;
    overflow-x: hidden;
  }

  :global(.d2h-file-wrapper) {
    overflow-x: auto;
  }

  :global(.d2h-file-header) {
    background: var(--bg-card) !important;
    border-color: var(--border) !important;
    color: var(--text-primary) !important;
  }

  :global(.d2h-file-name) {
    color: var(--accent) !important;
  }

  :global(.d2h-code-line) {
    background: var(--bg-secondary) !important;
    color: var(--text-primary) !important;
  }

  :global(.d2h-code-line-ctn) {
    color: var(--text-primary) !important;
  }

  :global(.d2h-ins) {
    background: rgba(158, 206, 106, 0.15) !important;
  }

  :global(.d2h-del) {
    background: rgba(247, 118, 142, 0.15) !important;
  }

  :global(.d2h-info) {
    background: var(--bg-card) !important;
    color: var(--text-secondary) !important;
    border-color: var(--border) !important;
  }

  :global(.d2h-diff-table) {
    border-collapse: separate !important;
    border-spacing: 0;
  }

  :global(.d2h-code-linenumber) {
    position: sticky !important;
    left: 0;
    z-index: 1;
    background: var(--bg-card) !important;
    color: var(--text-secondary) !important;
    border-color: var(--border) !important;
  }

  :global(.d2h-code-side-linenumber) {
    position: sticky !important;
    left: 0;
    z-index: 1;
    background: var(--bg-card) !important;
    color: var(--text-secondary) !important;
    border-color: var(--border) !important;
  }

  :global(.d2h-moved-tag) {
    background: rgba(224, 175, 104, 0.2) !important;
    color: var(--warning) !important;
  }
</style>

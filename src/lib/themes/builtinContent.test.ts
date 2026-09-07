import { render, waitFor } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarkdownContent from '@openforge-app/plugin-sdk/ui/MarkdownContent.svelte'
import { BUILTIN_THEMES, LIGHT_THEME } from '../themeContract'
import { createThemeDocumentAdapter } from '../themeDocumentAdapter'

const { mermaid, mermaidId } = await vi.hoisted(async () => {
  const { createRequire } = await import('node:module')
  const { resolve } = await import('node:path')
  const requireSdk = createRequire(resolve(import.meta.dirname, '../../../packages/plugin-sdk/package.json'))
  return { mermaid: { initialize: vi.fn(), render: vi.fn() }, mermaidId: requireSdk.resolve('mermaid') }
})
vi.mock(mermaidId, () => ({ default: mermaid }))

const adapter = createThemeDocumentAdapter(document.documentElement)
afterEach(() => adapter.apply(LIGHT_THEME))

describe.each(BUILTIN_THEMES)('$label Markdown presentation', (theme) => {
  it('renders a diagram with the declared appearance and keeps code readable', async () => {
    mermaid.initialize.mockClear()
    mermaid.render.mockResolvedValue({ svg: '<svg><text>Build complete</text></svg>' })
    adapter.apply(theme)
    const { container } = render(MarkdownContent, {
      content: '# Build report\n\n```ts\nconst ready = true\n```\n\n```mermaid\ngraph TD\n A --> B\n```',
    })
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull())
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
      theme: theme.appearance === 'dark' ? 'dark' : 'default',
    }))
    expect(container.textContent).toContain('const ready = true')
    expect(document.documentElement.style.getPropertyValue('--of-code-text')).toBe(theme.tokens.codeText)
    expect(document.documentElement.style.getPropertyValue('--of-diff-added')).toBe(theme.tokens.diffAdded)
    expect(document.documentElement.style.getPropertyValue('--of-diff-removed')).toBe(theme.tokens.diffRemoved)
  })
})

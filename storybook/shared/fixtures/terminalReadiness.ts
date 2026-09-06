import { expect, waitFor } from 'storybook/test'
import { getStoryScenario } from '../storyEnvironmentPreview'

type TerminalStoryContext = { loaded: Record<string, unknown>; canvasElement: HTMLElement }

/** Readiness means the production view has consumed and painted its replay, not just mounted xterm. */
export async function terminalReady(context: TerminalStoryContext, expectedText = 'OpenForge Terminal') {
  const terminal = getStoryScenario(context).terminal!
  await context.canvasElement.ownerDocument.fonts.ready
  await waitFor(async () => {
    const visible = terminal.runtime.diagnostics.list().filter(key => terminal.runtime.diagnostics.observe(key).view.visible)
    expect(visible.length).toBeGreaterThan(0)
    for (const key of visible) {
      const state = terminal.runtime.diagnostics.observe(key)
      expect(state.lifecycle.ptyActive || state.lifecycle.shellExited).toBe(true)
      expect(state.view.authorityReadPending, key).toBe(false)
      await terminal.runtime.diagnostics.drainPresentation(key)
      const text = terminal.runtime.diagnostics.capturePresentation(key).lines.map(line => line.text).join('\n')
      expect(text).toContain(expectedText)
    }
  }, { timeout: 10000 })
  // Local replay requests a steady ANSI cursor. Keep focus deterministic too.
  const input = [...context.canvasElement.querySelectorAll<HTMLTextAreaElement>('.xterm-helper-textarea')]
    .find(element => element.checkVisibility())
  input?.focus()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  context.canvasElement.setAttribute('data-terminal-ready', 'true')
}

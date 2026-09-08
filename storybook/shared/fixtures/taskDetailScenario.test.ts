import { describe, expect, it } from 'vitest'
import { Terminal } from '@xterm/xterm'
import { taskDetailScenario } from './taskDetailScenario'

describe('Task Detail terminal replay fixtures', () => {
  it.each(['active', 'waiting', 'failed', 'completed', 'terminal', 'review', 'long-content'] as const)(
    'supplies explicit empty base64 parser continuation for %s', (kind) => {
      const replay = taskDetailScenario(kind).environment.desktop?.responses?.get_pty_buffer
      expect(replay).toMatchObject({
        instanceId: 42,
        snapshot: { instanceId: 42, watermark: 0, continuationData: '' },
      })
    },
  )

  it.each(['active', 'waiting', 'failed', 'completed', 'terminal', 'review', 'long-content'] as const)(
    'disables cursor blinking after parsing the %s replay', async (kind) => {
      const replay = taskDetailScenario(kind).environment.desktop?.responses?.get_pty_buffer as { snapshot: { data: string } }
      const terminal = new Terminal({ cursorBlink: true })
      try {
        await new Promise<void>(resolve => terminal.write(atob(replay.snapshot.data), resolve))
        expect(terminal.options.cursorBlink).toBe(false)
      } finally {
        terminal.dispose()
      }
    },
  )
})

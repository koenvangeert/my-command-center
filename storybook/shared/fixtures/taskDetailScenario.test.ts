import { Terminal } from '@xterm/xterm'
import { describe, expect, it, vi } from 'vitest'
import { createDesktopTerminalTransport, type DesktopPtyBufferState } from '../../../src/lib/desktopTerminalTransport'
import { createStoryDesktopAdapter } from '../environment/storyDesktopAdapter'
import { taskDetailScenario } from './taskDetailScenario'

describe('task workspace terminal replay', () => {
  it.each(['active', 'waiting', 'failed', 'completed', 'review'] as const)('decodes the %s fixture through the production transport', async kind => {
    const desktop = createStoryDesktopAdapter(taskDetailScenario(kind).environment.desktop)
    const transport = createDesktopTerminalTransport({
      getPtyBuffer: async () => await desktop.bridge.invoke('get_pty_buffer', {}) as DesktopPtyBufferState,
      listenEvent: vi.fn(), writePty: vi.fn(), resizePty: vi.fn(),
    })
    try {
      const replay = await transport.readReplay('T-42')
      expect(new TextDecoder().decode(replay.snapshot?.data)).toContain('OpenForge agent')
      expect(replay.snapshot?.continuationData).toEqual(new Uint8Array())
    } finally {
      transport.dispose()
      desktop.dispose()
    }
  })
})

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

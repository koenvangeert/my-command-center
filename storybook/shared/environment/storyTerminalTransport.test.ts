import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoryTerminalTransport } from './storyTerminalTransport'
import { createTerminalRuntime, createTerminalSessionService } from '@openforge-app/terminal-runtime'
import { createFakeTerminalView } from '@openforge-app/terminal-runtime/testUtils'

describe('local Terminal story transport', () => {
  it.each(['ready', 'empty', 'overflow', 'disconnected'] as const)(
    'provides explicit parser-ground continuation for %s replay and respawn', async (state) => {
      const transport = createStoryTerminalTransport(state)
      try {
        const replay = await transport.readReplay('T-42-shell-0')
        expect(replay.snapshot?.continuationData).toEqual(new Uint8Array())
        const instance = transport.spawn('T-42-shell-0')
        const respawned = await transport.readReplay('T-42-shell-0')
        expect(respawned.snapshot).toMatchObject({
          continuationData: new Uint8Array(), ptyInstanceId: instance, watermark: 0,
        })
      } finally {
        transport.dispose()
      }
    },
  )

  it('buffers output for inactive subscriptions and replays it when requested', async () => {
    const transport = createStoryTerminalTransport()
    const onModelOutput = vi.fn()
    const subscription = await transport.subscribeSession('T-42-shell-0', { onModelOutput, onExit() {}, onModelDisabled() {} })
    await subscription.setModelOutputEnabled(false)
    transport.emit('T-42-shell-0', 'while inactive')
    expect(onModelOutput).not.toHaveBeenCalled()
    const replay = await transport.readReplay('T-42-shell-0')
    expect(replay.snapshot?.watermark).toBe(1)
    expect(new TextDecoder().decode(replay.snapshot?.data)).toContain('while inactive')
    await subscription.setModelOutputEnabled(true)
    transport.emit('T-42-shell-0', 'while active')
    expect(onModelOutput).toHaveBeenCalledOnce()
    subscription.dispose()
    transport.dispose()
  })

  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('replays the current instance, filters stale events, and releases each owner before teardown', async () => {
    const transport = createStoryTerminalTransport()
    const view = createFakeTerminalView()
    const runtime = createTerminalRuntime({ transport, createTerminalView: () => view, environment: { openLink: async () => {} } })
    const service = createTerminalSessionService(runtime)
    const first = service.createClient('first')
    const second = service.createClient('second')
    const session = await first.acquire('T-42-shell-0')
    await second.acquire('T-42-shell-0')
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}
      observe() { this.callback([{ isIntersecting: true }]) }
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480)
    await runtime.attach(session, document.createElement('div'))
    const replay = await transport.readReplay('T-42-shell-0')
    transport.emit('T-42-shell-0', 'stale', replay.ptyInstanceId! - 1)
    transport.exit('T-42-shell-0', replay.ptyInstanceId! - 1)
    expect(runtime.isPtyActive('T-42-shell-0')).toBe(true)
    expect(view.writeLive).not.toHaveBeenCalled()
    transport.emit('T-42-shell-0', 'accepted')
    expect(view.writeLive).toHaveBeenCalledWith(expect.objectContaining({ ptyInstanceId: replay.ptyInstanceId, sequence: 1 }))
    first.releaseAll()
    expect(runtime.hasTerminal('T-42-shell-0')).toBe(true)
    second.releaseAll()
    expect(runtime.hasTerminal('T-42-shell-0')).toBe(false)
    service.dispose()
    transport.dispose()
    expect(transport.resources()).toEqual({ sessions: 0, listeners: 0 })
  })

  it('keeps replay and keyboard input scoped to each shell without a host connection', async () => {
    const transport = createStoryTerminalTransport()
    const first = await transport.readReplay('T-42-shell-0')
    const second = await transport.readReplay('T-42-shell-1')
    expect(first.isLive).toBe(true)
    expect(first.snapshot?.ptyInstanceId).toBe(first.ptyInstanceId)
    expect(second.ptyInstanceId).not.toBe(first.ptyInstanceId)
    await transport.writeUserInput('T-42-shell-1', 'pwd\r')
    expect(transport.inputs).toEqual([{ shellSessionKey: 'T-42-shell-1', data: 'pwd\r' }])
    expect(new TextDecoder().decode((await transport.readReplay('T-42-shell-0')).snapshot?.data)).not.toContain('pwd')
    expect(new TextDecoder().decode((await transport.readReplay('T-42-shell-1')).snapshot?.data)).toContain('pwd')
    transport.dispose()
    expect(transport.resources()).toEqual({ sessions: 0, listeners: 0 })
  })
})

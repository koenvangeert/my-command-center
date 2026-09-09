import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTrustedPluginTerminalTransport,
  type TrustedPluginTerminalPort,
} from './trustedPluginTerminalTransport'

function createHarness(dispose: () => void | Promise<void>) {
  const disposers: ReturnType<typeof vi.fn>[] = []
  const onGlobal = vi.fn<TrustedPluginTerminalPort['events']['onGlobal']>(() => {
    const cleanup = vi.fn(dispose)
    disposers.push(cleanup)
    return { dispose: cleanup }
  })
  const port: TrustedPluginTerminalPort = {
    events: { onGlobal },
    shell: {
      getBuffer: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
    },
  }
  return { transport: createTrustedPluginTerminalTransport(() => port), onGlobal, disposers }
}

const handlers = () => ({ onModelOutput: vi.fn(), onModelDisabled: vi.fn(), onExit: vi.fn() })

// Cross an event-loop turn so unhandled rejections would reach Vitest and this listener.
const flushRejections = () => new Promise(resolve => setTimeout(resolve, 0))

describe('trusted plugin terminal cleanup', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['session', 'transport', 'disable'] as const)(
    'reports async failures and continues %s cleanup without unhandled rejections',
    async mode => {
      const error = new Error('session cleanup failed')
      const report = vi.spyOn(console, 'error').mockImplementation(() => {})
      const unhandled = vi.fn()
      process.on('unhandledRejection', unhandled)
      try {
        const { transport, disposers } = createHarness(async () => { throw error })
        const session = await transport.subscribeSession('T-1-shell-2', handlers())
        await session.setModelOutputEnabled(true)
        await transport.subscribeConnectionRestored(vi.fn())
        if (mode === 'disable') {
          await session.setModelOutputEnabled(false)
          await session.setModelOutputEnabled(true)
        }
        if (mode === 'session') session.dispose()
        transport.dispose()
        session.dispose()
        transport.dispose()
        await flushRejections()
        expect(disposers).toHaveLength(mode === 'disable' ? 5 : 4)
        for (const dispose of disposers) expect(dispose).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledTimes(disposers.length)
        for (const call of report.mock.calls) {
          expect(call).toEqual(['[terminal plugin] Failed to dispose terminal subscription', error])
        }
        expect(unhandled).not.toHaveBeenCalled()
      } finally {
        process.off('unhandledRejection', unhandled)
      }
    },
  )

  it.each(['session', 'connection'] as const)(
    'preserves the registration error when async %s rollback rejects',
    async mode => {
      const error = new Error('rollback failed')
      const registrationError = new Error('registration failed')
      const report = vi.spyOn(console, 'error').mockImplementation(() => {})
      const unhandled = vi.fn()
      process.on('unhandledRejection', unhandled)
      try {
        const { transport, onGlobal, disposers } = createHarness(async () => { throw error })
        if (mode === 'session') {
          const register = onGlobal.getMockImplementation()!
          onGlobal.mockImplementationOnce(register).mockImplementationOnce(() => { throw registrationError })
          await expect(transport.subscribeSession('T-1-shell-2', handlers())).rejects.toBe(registrationError)
        } else {
          const register = onGlobal.getMockImplementation()!
          onGlobal.mockImplementationOnce((event, handler) => {
            transport.dispose()
            return register(event, handler)
          })
          await expect(transport.subscribeConnectionRestored(vi.fn())).rejects.toThrow('TerminalTransport is disposed')
        }
        transport.dispose()
        await flushRejections()
        expect(disposers).toHaveLength(1)
        expect(disposers[0]).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledExactlyOnceWith('[terminal plugin] Failed to dispose terminal subscription', error)
        expect(unhandled).not.toHaveBeenCalled()
      } finally {
        process.off('unhandledRejection', unhandled)
      }
    },
  )

  it('reports synchronous failures without skipping later disposals', async () => {
    const error = new Error('sync cleanup failed')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { transport, disposers } = createHarness(() => { throw error })
    const session = await transport.subscribeSession('T-1-shell-2', handlers())
    await session.setModelOutputEnabled(true)
    await transport.subscribeConnectionRestored(vi.fn())
    expect(() => transport.dispose()).not.toThrow()
    session.dispose()
    transport.dispose()
    expect(disposers).toHaveLength(4)
    for (const dispose of disposers) expect(dispose).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledTimes(4)
    for (const call of report.mock.calls) {
      expect(call).toEqual(['[terminal plugin] Failed to dispose terminal subscription', error])
    }
  })

  it('reports rejected connection cleanup once without unhandled rejections', async () => {
    const error = new Error('connection cleanup failed')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { transport, disposers } = createHarness(async () => { throw error })
      const subscription = await transport.subscribeConnectionRestored(vi.fn())
      subscription.dispose()
      subscription.dispose()
      transport.dispose()
      await flushRejections()
      expect(disposers[0]).toHaveBeenCalledTimes(1)
      expect(report).toHaveBeenCalledExactlyOnceWith('[terminal plugin] Failed to dispose terminal subscription', error)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})

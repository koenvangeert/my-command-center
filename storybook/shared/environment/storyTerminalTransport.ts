import type {
  TerminalTransport, TerminalReplay, TerminalSessionTransportHandlers,
} from '@openforge-app/terminal-runtime'

export type TerminalStoryState = 'ready' | 'empty' | 'overflow' | 'disconnected'

// DECSCUSR selects a steady block; DECRST 12 also notifies xterm's active
// renderer to stop an already-created blink timer.
const STEADY_CURSOR = '\u001b[2 q\u001b[?12l'

/** In-memory ANSI replay and echo only. No desktop bridge, process, or shell evaluation. */
export function createStoryTerminalTransport(state: TerminalStoryState = 'ready') {
  const sessions = new Map<string, { instance: number; sequence: number; text: string; live: boolean }>()
  type Subscription = { handlers: TerminalSessionTransportHandlers; enabled: boolean }
  const listeners = new Map<string, Set<Subscription>>()
  const connections = new Set<() => void>()
  const inputs: Array<{ shellSessionKey: string; data: string }> = []
  let nextInstance = 100
  let disposed = false

  function session(key: string) {
    if (disposed) throw new Error('Terminal story transport is disposed')
    let value = sessions.get(key)
    if (!value) {
      const heading = '\u001b[32mOpenForge Terminal\u001b[0m\r\nLocal story session. Commands are echoed, never executed.\r\n'
      const content = state === 'empty' ? '' : heading + (state === 'overflow'
        ? Array.from({ length: 80 }, (_, i) => `build ${i + 1}: passed ${'module/'.repeat(20)}\r\n`).join('')
        : 'workspace /projects/openforge\r\n') + '$ '
      // A steady ANSI cursor keeps replay snapshots deterministic without changing xterm styling.
      value = { instance: nextInstance++, sequence: 0, text: STEADY_CURSOR + content, live: state !== 'disconnected' }
      sessions.set(key, value)
    }
    return value
  }

  function emit(key: string, text: string, instance = session(key).instance) {
    const value = session(key)
    const sequence = instance === value.instance ? ++value.sequence : value.sequence + 1
    if (instance === value.instance) value.text += text
    for (const listener of listeners.get(key) ?? []) {
      if (listener.enabled) listener.handlers.onModelOutput({
        data: new TextEncoder().encode(text), ptyInstanceId: instance, startSequence: sequence, sequence,
      })
    }
  }

  const transport = {
    async subscribeSession(key, handlers) {
      session(key)
      const handlersForKey = listeners.get(key) ?? new Set<Subscription>()
      const subscription = { handlers, enabled: false }
      handlersForKey.add(subscription)
      listeners.set(key, handlersForKey)
      return {
        async setModelOutputEnabled(enabled: boolean) { subscription.enabled = enabled },
        dispose() {
          handlersForKey.delete(subscription)
          if (!handlersForKey.size) listeners.delete(key)
        },
      }
    },
    async subscribeConnectionRestored(handler) {
      if (disposed) throw new Error('Terminal story transport is disposed')
      connections.add(handler)
      return { dispose() { connections.delete(handler) } }
    },
    async readReplay(key): Promise<TerminalReplay> {
      const value = session(key)
      return {
        historicalData: null, isLive: value.live, ptyInstanceId: value.instance,
        snapshot: {
          data: new TextEncoder().encode(value.text),
          // The story replays its complete ANSI stream, so no separate parser continuation is needed.
          continuationData: new Uint8Array(),
          ptyInstanceId: value.instance, watermark: value.sequence,
        },
      }
    },
    async writeUserInput(shellSessionKey, data) {
      session(shellSessionKey)
      inputs.push({ shellSessionKey, data })
      emit(shellSessionKey, data.replaceAll('\r', '\r\n$ '))
    },
    async resize(key) { session(key) },
    dispose() {
      disposed = true
      sessions.clear()
      listeners.clear()
      connections.clear()
      inputs.length = 0
    },
  } satisfies TerminalTransport

  return Object.assign(transport, {
    inputs,
    emit,
    exit(key: string, instance = session(key).instance) {
      if (instance === session(key).instance) session(key).live = false
      for (const { handlers } of listeners.get(key) ?? []) handlers.onExit({ ptyInstanceId: instance })
    },
    spawn(key: string) {
      const value = session(key)
      value.instance = nextInstance++
      value.sequence = 0
      value.text = STEADY_CURSOR
      value.live = true
      return value.instance
    },
    reconnect() { for (const handler of connections) handler() },
    resources() {
      return { sessions: sessions.size, listeners: connections.size + [...listeners.values()].reduce((n, set) => n + set.size, 0) }
    },
  })
}

import {
  createLiveModelOutputSubscriptionLifecycle,
  decodeTerminalBase64,
  decodeTerminalReplay,
  parsePtySessionKey,
  type TerminalSessionTransportHandlers,
  type TerminalSessionTransportSubscription,
  type TerminalTransport,
  type TerminalTransportDisposable,
} from '@openforge-app/terminal-runtime'

interface TrustedPluginDisposable {
  dispose(): void | Promise<void>
}


interface TrustedPluginPtyExitPayload {
  instance_id: number
}

interface TrustedPluginTerminalModelOutputPayload {
  data: string
  instance_id: number
  start_sequence?: number
  sequence: number
}

interface TrustedPluginTerminalModelDisabledPayload {
  instance_id: number
}

type TrustedPluginPtyBufferState = import('@openforge-app/plugin-sdk').PtyBufferState

interface IndexedShellRequest {
  taskId: string
  terminalIndex: number
}

export interface TrustedPluginTerminalPort {
  events: {
    onGlobal<TPayload>(eventName: string, handler: (payload: TPayload) => void): TrustedPluginDisposable
  }
  shell: {
    getBuffer(request: IndexedShellRequest): Promise<TrustedPluginPtyBufferState>
    write(request: IndexedShellRequest & { data: string }): Promise<void>
    resize(request: IndexedShellRequest & { cols: number; rows: number }): Promise<void>
  }
}

function parseIndexedShellSessionKey(shellSessionKey: string): IndexedShellRequest {
  const parsed = parsePtySessionKey(shellSessionKey)
  if (parsed.kind !== 'indexed-shell') {
    throw new Error(`[terminal plugin] Expected indexed terminal key, received: ${shellSessionKey}`)
  }
  return { taskId: parsed.taskId, terminalIndex: parsed.terminalIndex }
}


// The transport's disposal contract is synchronous. Observe async cleanup without
// delaying other disposals, and report sync failures through the same channel.
function disposeSubscription(subscription: TrustedPluginDisposable): void {
  const report = (error: unknown) => {
    console.error('[terminal plugin] Failed to dispose terminal subscription', error)
  }
  try {
    void Promise.resolve(subscription.dispose()).catch(report)
  } catch (error) {
    report(error)
  }
}

export function createTrustedPluginTerminalTransport(
  getPort: () => TrustedPluginTerminalPort,
): TerminalTransport {
  const activeSubscriptions = new Set<TerminalTransportDisposable>()
  let disposed = false

  function ensureActive(): void {
    if (disposed) throw new Error('Trusted Plugin TerminalTransport is disposed')
  }

  function track(disposables: TrustedPluginDisposable[]): TerminalTransportDisposable {
    let active = true
    const subscription = {
      dispose() {
        if (!active) return
        active = false
        activeSubscriptions.delete(subscription)
        for (const disposable of disposables) {
          disposeSubscription(disposable)
        }
      },
    }
    activeSubscriptions.add(subscription)
    return subscription
  }

  async function subscribeSession(
    shellSessionKey: string,
    handlers: TerminalSessionTransportHandlers,
  ): Promise<TerminalSessionTransportSubscription> {
    ensureActive()
    parseIndexedShellSessionKey(shellSessionKey)
    const events = getPort().events
    const lifecycleSubscriptions: TrustedPluginDisposable[] = []
    const modelOutputLifecycle = createLiveModelOutputSubscriptionLifecycle({
      register: () => events.onGlobal<TrustedPluginTerminalModelOutputPayload>(
        `openforge.pty-model-output-${shellSessionKey}`,
        payload => handlers.onModelOutput({
          data: decodeTerminalBase64(payload.data),
          ptyInstanceId: payload.instance_id,
          startSequence: payload.start_sequence ?? payload.sequence,
          sequence: payload.sequence,
        }),
      ),
      dispose: disposeSubscription,
      disposedErrorMessage: 'Trusted Plugin terminal session subscription is disposed',
    })
    let active = true
    try {
      lifecycleSubscriptions.push(events.onGlobal<TrustedPluginTerminalModelDisabledPayload>(
        `openforge.pty-model-disabled-${shellSessionKey}`,
        payload => handlers.onModelDisabled({ ptyInstanceId: payload.instance_id }),
      ))
      lifecycleSubscriptions.push(events.onGlobal<TrustedPluginPtyExitPayload>(
        `openforge.pty-exit-${shellSessionKey}`,
        payload => handlers.onExit({ ptyInstanceId: payload.instance_id }),
      ))
      ensureActive()
      const subscription: TerminalSessionTransportSubscription = {
        async setModelOutputEnabled(enabled) {
          ensureActive()
          await modelOutputLifecycle.setEnabled(enabled)
        },
        dispose() {
          if (!active) return
          active = false
          activeSubscriptions.delete(subscription)
          modelOutputLifecycle.dispose()
          for (const lifecycleSubscription of lifecycleSubscriptions) {
            disposeSubscription(lifecycleSubscription)
          }
        },
      }
      activeSubscriptions.add(subscription)
      return subscription
    } catch (error) {
      for (const lifecycleSubscription of lifecycleSubscriptions) {
        disposeSubscription(lifecycleSubscription)
      }
      throw error
    }
  }

  async function subscribeConnectionRestored(
    handler: Parameters<TerminalTransport['subscribeConnectionRestored']>[0],
  ): Promise<TerminalTransportDisposable> {
    ensureActive()
    const subscription = getPort().events.onGlobal<unknown>(
      'openforge.openforge-app-events-reconnected',
      () => handler(),
    )
    if (disposed) {
      disposeSubscription(subscription)
      throw new Error('Trusted Plugin TerminalTransport is disposed')
    }
    return track([subscription])
  }

  async function readReplay(shellSessionKey: string) {
    ensureActive()
    const replay = await getPort().shell.getBuffer(parseIndexedShellSessionKey(shellSessionKey))
    return decodeTerminalReplay(replay)
  }

  async function writeUserInput(shellSessionKey: string, data: string): Promise<void> {
    ensureActive()
    await getPort().shell.write({ ...parseIndexedShellSessionKey(shellSessionKey), data })
  }


  async function resize(shellSessionKey: string, geometry: { cols: number; rows: number }): Promise<void> {
    ensureActive()
    await getPort().shell.resize({
      ...parseIndexedShellSessionKey(shellSessionKey),
      cols: geometry.cols,
      rows: geometry.rows,
    })
  }

  return {
    subscribeSession,
    subscribeConnectionRestored,
    readReplay,
    writeUserInput,
    resize,
    dispose() {
      if (disposed) return
      disposed = true
      for (const subscription of [...activeSubscriptions]) {
        disposeSubscription(subscription)
      }
    },
  }
}

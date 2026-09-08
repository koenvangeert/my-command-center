import type { PtyBufferState } from '@openforge-app/plugin-sdk'
import type { TerminalReplay } from './terminalTransport'

type Uint8ArrayBase64Constructor = typeof Uint8Array & {
  fromBase64?(value: string): Uint8Array
}

export function decodeTerminalBase64(value: string): Uint8Array {
  const constructor = Uint8Array as Uint8ArrayBase64Constructor
  if (constructor.fromBase64) return constructor.fromBase64(value)

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/** Decode the SDK wire contract without changing replay or PTY identity semantics. */
export function decodeTerminalReplay(replay: PtyBufferState): TerminalReplay {
  const snapshot = replay.snapshot
  return {
    historicalData: replay.buffer,
    isLive: replay.isLive,
    ptyInstanceId: replay.instanceId,
    snapshot: snapshot
      ? {
          data: decodeTerminalBase64(snapshot.data),
          continuationData: decodeTerminalBase64(snapshot.continuationData),
          ptyInstanceId: snapshot.instanceId,
          watermark: snapshot.watermark,
          compatibilityData: snapshot.compatibilityData
            ? decodeTerminalBase64(snapshot.compatibilityData)
            : undefined,
        }
      : undefined,
  }
}

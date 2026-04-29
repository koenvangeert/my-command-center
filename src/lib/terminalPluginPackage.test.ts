import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { commandHeld, setupCommandHeldListeners } from '../../plugins/terminal/src/lib/stores'

describe('builtin terminal plugin package integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    commandHeld.set(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('detects Command key holds before terminal inputs can stop bubbling', () => {
    const cleanup = setupCommandHeldListeners()
    const terminalInput = document.createElement('textarea')
    terminalInput.addEventListener('keydown', (event) => {
      event.stopPropagation()
    })
    document.body.appendChild(terminalInput)

    terminalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', bubbles: true }))
    vi.advanceTimersByTime(150)

    expect(get(commandHeld)).toBe(true)

    terminalInput.remove()
    cleanup()
  })
})

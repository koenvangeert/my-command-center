import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { commandHeld, setupCommandHeldListeners } from './stores'

describe('terminal plugin command-held store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    commandHeld.set(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sets commandHeld when the terminal input stops keydown bubbling', () => {
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

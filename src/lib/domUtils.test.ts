import { afterEach, describe, expect, it } from 'vitest'
import { isInputFocused } from './domUtils'

describe('isInputFocused', () => {
  let element: HTMLElement
  const activeElementDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')

  afterEach(() => {
    element?.remove()

    if (activeElementDescriptor) {
      Object.defineProperty(document, 'activeElement', activeElementDescriptor)
    }
  })

  it('returns true when an input is focused', () => {
    element = document.createElement('input')
    document.body.appendChild(element)
    element.focus()
    expect(isInputFocused()).toBe(true)
  })

  it('returns true when a textarea is focused', () => {
    element = document.createElement('textarea')
    document.body.appendChild(element)
    element.focus()
    expect(isInputFocused()).toBe(true)
  })

  it('returns true when a select element is focused', () => {
    element = document.createElement('select')
    document.body.appendChild(element)
    element.focus()
    expect(isInputFocused()).toBe(true)
  })

  it('returns false for a non-HTMLElement active element without reading contentEditable', () => {
    const active = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

    Object.defineProperty(active, 'isContentEditable', {
      configurable: true,
      get() {
        throw new Error('should not read isContentEditable')
      },
    })

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => active,
    })

    expect(isInputFocused()).toBe(false)
  })
})

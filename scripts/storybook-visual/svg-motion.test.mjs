import { afterEach, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { freezeSvgMasks } from './svg-motion.mjs'

let dom
afterEach(() => { vi.unstubAllGlobals(); dom?.window.close() })

it('freezes production-style SVG masks at their terminal frame without changing static masks', () => {
  dom = new JSDOM('<div id="spinner"></div><div id="static"></div>')
  for (const name of ['document', 'DOMParser', 'XMLSerializer']) vi.stubGlobal(name, dom.window[name])
  vi.stubGlobal('getComputedStyle', dom.window.getComputedStyle.bind(dom.window))
  const spinner = document.querySelector('#spinner')
  const still = document.querySelector('#static')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="9.5"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="2s" repeatCount="indefinite"/><animate attributeName="stroke-dasharray" values="0,150;42,150;42,150" dur="1.5s" repeatCount="indefinite"/></circle></svg>`
  spinner.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  still.style.maskImage = 'linear-gradient(black, black)'
  const unchanged = still.style.maskImage
  freezeSvgMasks()
  const frozen = decodeURIComponent(spinner.style.maskImage)
  expect(frozen).not.toContain('<animate')
  expect(frozen).toContain('stroke-dasharray="42,150"')
  expect(frozen).toContain('transform="rotate(360 12 12)"')
  expect(frozen).toContain('r="9.5"')
  expect(still.style.maskImage).toBe(unchanged)
  freezeSvgMasks()
  expect(decodeURIComponent(spinner.style.maskImage)).toBe(frozen)
})

it('keeps a loading mask visible when its terminal keyframe is empty', () => {
  dom = new JSDOM('<div id="spinner"></div>')
  for (const name of ['document', 'DOMParser', 'XMLSerializer']) vi.stubGlobal(name, dom.window[name])
  vi.stubGlobal('getComputedStyle', dom.window.getComputedStyle.bind(dom.window))
  const spinner = document.querySelector('#spinner')
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle><animate attributeName="stroke-dasharray" values="0,150;42,150;0,150"/></circle></svg>'
  spinner.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  freezeSvgMasks('middle')
  expect(decodeURIComponent(spinner.style.maskImage)).toContain('stroke-dasharray="42,150"')
  expect(decodeURIComponent(spinner.style.maskImage)).not.toContain('<animate')
})

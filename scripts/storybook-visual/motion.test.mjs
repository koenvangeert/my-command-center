import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { freezeAnimatedSvgMasks } from './motion.mjs'

let browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

describe('embedded SVG motion in canonical captures', () => {
  it('keeps production DaisyUI spinners visible and pixel-stable as time passes', async () => {
    const page = await browser.newPage({ viewport: { width: 100, height: 100 }, reducedMotion: 'reduce' })
    try {
      const css = await readFile(new URL('../../node_modules/daisyui/components/loading.css', import.meta.url), 'utf8')
      await page.setContent(`<style>${css} *{animation:none!important;transition:none!important} body{margin:0;color:#333}</style><span class="loading loading-spinner"></span>`)
      await page.evaluate(freezeAnimatedSvgMasks)
      const svg = await page.locator('.loading').evaluate(element => decodeURIComponent(element.style.maskImage))
      expect(svg).not.toContain('<animate')
      expect(svg).toContain('stroke-dasharray="42,150"')
      expect(svg).toContain('stroke-dashoffset="-59"')
      const first = await page.screenshot()
      await page.waitForTimeout(250)
      expect(await page.screenshot()).toEqual(first)
    } finally { await page.close() }
  })

  it('leaves static masks unchanged and is idempotent', async () => {
    const page = await browser.newPage()
    try {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="8"/></svg>`
      await page.setContent(`<span style='mask-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")'></span>`)
      const before = await page.locator('span').getAttribute('style')
      await page.evaluate(freezeAnimatedSvgMasks)
      await page.evaluate(freezeAnimatedSvgMasks)
      expect(await page.locator('span').getAttribute('style')).toBe(before)
    } finally { await page.close() }
  })
})

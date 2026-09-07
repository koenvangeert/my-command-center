// @vitest-environment node
import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { chromium, type Browser, type Locator } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const harnessPath = 'src/components/focus-board/browser/empty-state.html'
let server: ViteDevServer
let browser: Browser
let origin: string

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve(import.meta.dirname, '../../..'),
    plugins: [svelte()],
    optimizeDeps: { entries: [harnessPath] },
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  origin = server.resolvedUrls!.local[0]
  browser = await chromium.launch({ headless: true })
}, 60_000)

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

// Read the browser's animated values, not the unchanged SVG source attributes.
function illustrationFrame(illustration: Locator) {
  return illustration.evaluate((element) => {
    const svg = element as SVGSVGElement
    return {
      time: svg.getCurrentTime(),
      glowRadius: svg.querySelector('ellipse')!.rx.animVal.value,
      glowOpacity: getComputedStyle(svg.querySelector('stop')!).stopOpacity,
      sparks: [...svg.querySelectorAll('circle')].map((circle) => ({
        x: circle.cx.animVal.value,
        y: circle.cy.animVal.value,
        radius: circle.r.animVal.value,
        opacity: getComputedStyle(circle).opacity,
      })),
      twinkles: [...svg.querySelectorAll('line')].map((line) => getComputedStyle(line).strokeOpacity),
    }
  })
}

describe('production Focus Board empty-state motion in Chromium', () => {
  it('keeps the illustration still when reduced motion is requested before mounting', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    try {
      // This fixture mounts the production component without Storybook's timeline adapter.
      await page.goto(`${origin}${harnessPath}`)
      const illustration = page.getByRole('img', { name: 'Peaceful forge illustration' })
      await illustration.waitFor()
      expect(await page.getByText('All clear', { exact: true }).isVisible()).toBe(true)
      const before = await illustrationFrame(illustration)
      // Cross the delayed SMIL start times as well as several browser frames.
      await page.waitForTimeout(4_000)
      expect(await illustrationFrame(illustration)).toEqual(before)
    } finally {
      await page.close()
    }
  }, 15_000)

  it('animates normally and freezes and resumes when the preference changes live', async () => {
    const page = await browser.newPage({ reducedMotion: 'no-preference' })
    try {
      await page.goto(`${origin}${harnessPath}`)
      const illustration = page.getByRole('img', { name: 'Peaceful forge illustration' })
      await illustration.waitFor()
      const initial = await illustrationFrame(illustration)
      await expect.poll(async () => (await illustrationFrame(illustration)).glowRadius).not.toBe(initial.glowRadius)
      await expect.poll(async () => (await illustrationFrame(illustration)).sparks[0].y).not.toBe(initial.sparks[0].y)

      // Repeat the switch to catch subscriptions that only handle the first change.
      for (let toggle = 0; toggle < 2; toggle++) {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await expect.poll(() => illustration.evaluate((svg) => (svg as SVGSVGElement).animationsPaused())).toBe(true)
        const frozen = await illustrationFrame(illustration)
        await page.waitForTimeout(300)
        expect(await illustrationFrame(illustration)).toEqual(frozen)

        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await expect.poll(async () => (await illustrationFrame(illustration)).time).toBeGreaterThan(frozen.time)
        await expect.poll(async () => (await illustrationFrame(illustration)).glowRadius).not.toBe(frozen.glowRadius)
        await expect.poll(async () => (await illustrationFrame(illustration)).sparks[0].y).not.toBe(frozen.sparks[0].y)
      }
    } finally {
      await page.close()
    }
  }, 15_000)
})

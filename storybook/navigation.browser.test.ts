import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { chromium, type Browser } from 'playwright'
import { serve } from '../scripts/storybook-visual/capture.mjs'

// Static builds are intentionally explicit, not side effects of the ordinary renderer suite.
const enabled = process.env.RUN_STORYBOOK_NAVIGATION === '1'
describe.runIf(enabled)('navigation catalog browser interactions', () => {
  let browser: Browser
  let server: Awaited<ReturnType<typeof serve>>
  beforeAll(async () => {
    server = await serve('storybook-static')
    browser = await chromium.launch({ headless: true })
  }, 30_000)
  afterAll(async () => { await browser?.close(); await server?.close() })

  it('runs every adopted workflow and control story twice in the same document without unexpected diagnostics', async () => {
    for (const catalog of ['pages', 'components']) {
      const index = JSON.parse(await readFile(`storybook-static/${catalog}/index.json`, 'utf8'))
      const ids = Object.keys(index.entries).filter(id => /^(pages-(project-switching|command-palette|action-palette|file-quick-open)|components-palette-controls)--/.test(id))
      expect(ids.length).toBeGreaterThan(catalog === 'pages' ? 30 : 5)
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort())
        const page = await context.newPage()
        for (const id of ids) {
          const diagnostics: string[] = []
          const onConsole = (message: import('playwright').ConsoleMessage) => {
            if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text())
          }
          const onPageError = (error: Error) => diagnostics.push(error.message)
          page.on('console', onConsole)
          page.on('pageerror', onPageError)
          try {
            await page.goto(`${server.url}/${catalog}/iframe.html?id=${id}&viewMode=story`)
            for (let pass = 0; pass < 2; pass++) {
              await page.locator(`body[data-navigation-ready="${id}"] [role="dialog"]`).waitFor({ timeout: 15_000 })
              expect(await page.getByRole('dialog').count(), id).toBe(1)
              const timelines = await page.evaluate(() => Array.from(document.querySelectorAll<SVGSVGElement>('svg:has(animate)')).map(svg => ({
                paused: svg.animationsPaused(), time: svg.getCurrentTime(),
              })))
              for (const timeline of timelines) expect(timeline, `${id} SVG timeline`).toEqual({ paused: true, time: 0 })
              if (pass === 1) expect(await page.evaluate(() => [
                localStorage.getItem('catalog-rerender-probe'), sessionStorage.getItem('catalog-rerender-probe'),
              ]), `${id} storage reset`).toEqual([null, null])
              const expected = id === 'pages-command-palette--failure'
                ? ['Failed to load active tasks: Error: Catalog task search unavailable']
                : id === 'pages-file-quick-open--failure'
                  ? ['[FileQuickOpen] search failed: Error: Catalog file search unavailable'] : []
              expect(diagnostics, `${id}, pass ${pass + 1}`).toEqual(expected)
              diagnostics.length = 0
              if (pass === 0) await page.evaluate((storyId) => {
                delete document.body.dataset.navigationReady
                localStorage.setItem('catalog-rerender-probe', 'changed')
                sessionStorage.setItem('catalog-rerender-probe', 'changed')
                const channel = (window as unknown as { __STORYBOOK_ADDONS_CHANNEL__: { emit: (event: string, data: unknown) => void } }).__STORYBOOK_ADDONS_CHANNEL__
                channel.emit('forceRemount', { storyId })
              }, id)
            }
          } catch (error) {
            throw new Error(`${id}: ${String(error)}\n${diagnostics.join('\n')}`)
          } finally {
            page.off('console', onConsole)
            page.off('pageerror', onPageError)
          }
        }
      } finally { await context.close() }
    }
  }, 240_000)
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { chromium, type Browser } from 'playwright'
import { serve } from '../scripts/storybook-visual/capture.mjs'

describe.runIf(process.env.RUN_STORYBOOK_SCHEDULES === '1')('Task Schedules catalog interactions and isolation', () => {
  let browser: Browser
  let server: Awaited<ReturnType<typeof serve>>
  beforeAll(async () => { server = await serve('storybook-static'); browser = await chromium.launch({ headless: true }) }, 30_000)
  afterAll(async () => { await browser?.close(); await server?.close() })

  it('runs every schedule story twice, resetting mutations, fixed time, panel widths and polling resources', async () => {
    const failures: string[] = []
    for (const catalog of ['pages', 'components']) {
      const index = JSON.parse(await readFile(`storybook-static/${catalog}/index.json`, 'utf8'))
      const ids = Object.keys(index.entries).filter(id => id.startsWith(`${catalog === 'pages' ? 'pages' : 'components'}-task-schedules--`))
      expect(ids.length).toBeGreaterThan(30)
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', reducedMotion: 'reduce' })
      await context.addInitScript(() => {
        const handles = new Set<number>()
        const originalSet = window.setInterval.bind(window)
        const originalClear = window.clearInterval.bind(window)
        window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
          const handle = originalSet(handler, delay, ...args)
          if (delay === 30_000) handles.add(handle)
          return handle
        }) as typeof window.setInterval
        window.clearInterval = ((handle?: number) => { handles.delete(handle!); originalClear(handle) }) as typeof window.clearInterval
        Object.defineProperty(window, '__schedulePollingCount', { get: () => handles.size })
      })
      try {
        const blocked: string[] = []
        await context.route('**/*', route => {
          if (new URL(route.request().url()).origin === server.url) return route.continue()
          blocked.push(route.request().url())
          return route.abort()
        })
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
              await page.locator(`[data-schedule-ready="${id}"]`).waitFor({ timeout: 15_000 })
              expect(diagnostics, `${id} pass ${pass + 1}`).toEqual([])
              expect(blocked, `${id} external requests`).toEqual([])
              expect(await page.evaluate(() => Date.now())).toBe(Date.UTC(2026, 0, 2, 9, 30))
              expect(await page.evaluate(() => Reflect.get(window, '__schedulePollingCount'))).toBe(catalog === 'pages' ? 1 : 0)
              expect(await page.evaluate(() => [
                localStorage.getItem('resizable-panel:task-schedules-inspector'),
                localStorage.getItem('resizable-panel:task-schedules-form'),
                sessionStorage.getItem('schedule-rerender-probe'),
              ])).toEqual([null, null, null])
              if (pass === 0) await page.evaluate(storyId => {
                document.querySelector('[data-schedule-ready]')?.removeAttribute('data-schedule-ready')
                localStorage.setItem('resizable-panel:task-schedules-inspector', '610')
                localStorage.setItem('resizable-panel:task-schedules-form', '630')
                sessionStorage.setItem('schedule-rerender-probe', 'changed')
                Reflect.get(window, '__STORYBOOK_ADDONS_CHANNEL__').emit('forceRemount', { storyId })
              }, id)
            }
            // Switch without navigating the document. Outgoing held calls and the View's poller must be released.
            const other = Object.keys(index.entries).find(story => story.includes('catalog') && story !== id)
            if (!other) throw new Error('Missing catalog foundation story for teardown check')
            await page.evaluate(storyId => Reflect.get(window, '__STORYBOOK_ADDONS_CHANNEL__').emit('setCurrentStory', { storyId, viewMode: 'story' }), other)
            await page.getByTestId('theme-fixture').waitFor()
            await expect.poll(() => page.evaluate(() => Reflect.get(window, '__schedulePollingCount'))).toBe(0)
            expect(diagnostics, `${id} teardown`).toEqual([])
          } catch (error) {
            failures.push(`${id}: ${String(error).slice(0, 1600)}\n${diagnostics.join('\n').slice(0, 2200)}`)
          } finally {
            page.off('console', onConsole)
            page.off('pageerror', onPageError)
          }
        }
      } finally { await context.close() }
    }
    expect(failures).toEqual([])
  }, 600_000)
})

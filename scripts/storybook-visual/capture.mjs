import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { freezeSvgMasks } from './svg-motion.mjs'
import { captureAppearance } from './manifest.mjs'
import { PNG } from 'pngjs'
import { freezeMotionCss, freezeNativeMedia } from './native-media.mjs'

export async function serve(root) {
  const base = resolve(root)
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(base, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname))
      if (!path.startsWith(base + sep)) throw new Error('outside static root')
      const bytes = await readFile(path)
      response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' })
      response.end(bytes)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) }
}

// Readiness and disabled animations can still precede Chromium's final raster paint.
// Compare decoded pixels, not PNG encoding, and never consult the baseline to settle.
async function settledScreenshot(page, timeout) {
  const deadline = performance.now() + timeout
  const remaining = () => Math.max(1, Math.ceil(deadline - performance.now()))
  let previous, timedOut
  try {
    while (performance.now() < deadline) {
      if (previous) {
        // Cross a paint boundary so duplicate reads of one frame cannot count as stability.
        const paint = await page.waitForFunction(() => new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))
        }), null, { timeout: remaining() })
        await paint.dispose()
      }
      const bytes = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css', timeout: remaining() })
      const frame = PNG.sync.read(bytes)
      if (previous && frame.width === previous.width && frame.height === previous.height && frame.data.equals(previous.data)) return bytes
      previous = frame
    }
  } catch (error) {
    if (error?.name !== 'TimeoutError') throw error
    timedOut = error
  }
  throw new Error(`Screenshot did not settle within ${timeout}ms`, { cause: timedOut })
}

// Runs in the page. Keep failure evidence bounded and independent of Storybook internals.
function readinessEvidence() {
  const storyError = document.querySelector('.sb-errordisplay')
  return {
    visibility: document.visibilityState,
    fonts: document.fonts.status,
    terminals: [...document.querySelectorAll('[data-terminal-progress]')].slice(0, 16).map(element => ({
      progress: element.getAttribute('data-terminal-progress'),
      observedAtMs: Math.round(performance.now()),
    })),
    tabs: {
      count: document.querySelectorAll('[role=tab]').length,
      selected: document.querySelector('[role=tab][aria-selected=true]')?.textContent?.slice(0, 160),
    },
    storyError: storyError?.checkVisibility() ? storyError.textContent?.slice(0, 2000) : undefined,
  }
}

async function collectReadinessEvidence(page) {
  let timer
  try {
    return await Promise.race([
      page.evaluate(readinessEvidence),
      new Promise(resolve => { timer = setTimeout(() => resolve({ unavailable: 'page did not respond within 1000ms' }), 1000) }),
    ])
  } catch (error) {
    return { unavailable: error.message }
  } finally {
    clearTimeout(timer)
  }
}

export async function capture(browser, url, entry, { prepare, mutate, timeout = 30000 } = {}) {
  const context = await browser.newContext({ viewport: entry.viewport, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', colorScheme: captureAppearance(entry.theme), reducedMotion: 'reduce', serviceWorkers: 'block' })
  try {
    // Stories may only fetch their local catalog. Fonts ship with production CSS.
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage()
    page.setDefaultTimeout(timeout)
    const errors = []
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.setFixedTime(new Date('2026-01-02T09:30:00.000Z'))
    if (prepare) await prepare(page)
    await page.goto(`${url}/${entry.catalog}/iframe.html?id=${entry.story}&viewMode=story&globals=openforgeTheme:${entry.theme}`, { waitUntil: 'networkidle', timeout })
    try {
      // A ready selector can match the initial state before the play function edits it.
      // Storybook 10's pinned preview exposes the terminal render phase here.
      await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished')
      await page.locator(entry.ready).first().waitFor({ state: 'visible' })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => document.fonts.check('14px Inter'))
    } catch (error) {
      const evidence = await collectReadinessEvidence(page)
      throw new Error(`missing readiness for ${entry.story}: ${entry.ready}\n${errors.join('\n')}\n${error.message}\nReadiness evidence: ${JSON.stringify(evidence)}`)
    }
    await page.addStyleTag({ content: freezeMotionCss })
    if (mutate) await mutate(page)
    await page.evaluate(freezeSvgMasks)
    await freezeNativeMedia(page, timeout)
    const bytes = await settledScreenshot(page, timeout)
    return { bytes, diagnostics: errors }
  } finally {
    await context.close()
  }
}

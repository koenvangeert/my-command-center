import { afterAll, beforeAll, expect, test } from 'vitest'
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { capture, serve } from './capture.mjs'
import clip from '../../storybook/shared/fixtures/file-viewer/video.json' with { type: 'json' }

const require = createRequire(import.meta.url)
let root, server, browser
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'storybook-native-media-'))
  await mkdir(join(root, 'pages'))
  await copyFile(require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff2'), join(root, 'pages/Inter.woff2'))
  await writeFile(join(root, 'pages/iframe.html'), `<!doctype html><html><head><style>
    @font-face { font-family: Inter; src: url(Inter.woff2); }
    body { margin: 0; font: 14px Inter; } video { width:320px; height:180px; }
  </style></head><body><h1>Native video controls</h1><video controls preload="metadata"></video><p role="status"></p>
  <script>
    const video = document.querySelector('video');
    const failed = new URLSearchParams(location.search).get('id') === 'media--failed';
    video.addEventListener('error', () => document.querySelector('[role=status]').textContent = 'Unavailable');
    video.addEventListener('loadeddata', () => document.querySelector('[role=status]').textContent = 'Loaded');
    video.src = 'data:video/webm;base64,' + (failed ? 'AA==' : ${JSON.stringify(clip.content)});
    // This static host has no play function; advertise Storybook's completed render phase.
    window.__STORYBOOK_PREVIEW__ = { currentRender: { phase: 'finished' } };
  </script></body></html>`)
  server = await serve(root)
  browser = await chromium.launch({ headless: true })
})
afterAll(async () => {
  await browser?.close()
  await server?.close()
  if (root) await rm(root, { recursive: true, force: true })
})

for (const [story, ready] of [['media--loaded', 'text=Loaded'], ['media--failed', 'text=Unavailable']]) {
  test(`capture freezes native controls without replacing the ${story} player`, async () => {
    const entry = { catalog: 'pages', story, ready, theme: 'openforge-light', viewport: { width: 480, height: 320 } }
    const captures = []
    for (let index = 0; index < 4; index++) {
      const result = await capture(browser, server.url, entry)
      expect(result.diagnostics).toEqual([])
      captures.push(PNG.sync.read(result.bytes).data)
    }
    for (const pixels of captures.slice(1)) expect(pixels.equals(captures[0])).toBe(true)
  }, 30_000)
}

test('rejects playing fixtures and closes their browser context', async () => {
  const entry = { catalog: 'pages', story: 'media--loaded', ready: 'text=Loaded', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  await expect(capture(browser, server.url, entry, {
    mutate: page => page.locator('video').evaluate(async video => { video.muted = true; await video.play() }),
  })).rejects.toThrow('must be paused')
  expect(browser.contexts()).toHaveLength(0)
})

test('preserves unexpected diagnostics while freezing native controls', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  const result = await capture(browser, server.url, entry, { mutate: page => page.evaluate(() => console.error('native capture diagnostic probe')) })
  expect(result.diagnostics).toEqual(['native capture diagnostic probe'])
  expect(browser.contexts()).toHaveLength(0)
})

test('returns settled pixels rather than a transient first paint', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  const result = await capture(browser, server.url, entry, {
    mutate: async page => {
      const screenshot = page.screenshot.bind(page)
      const transient = PNG.sync.read(await screenshot())
      transient.data.set([255, 0, 255, 255], 0)
      let first = true
      // Inject one compositor glitch at the external browser API boundary.
      page.screenshot = options => {
        if (!first) return screenshot(options)
        first = false
        return Promise.resolve(PNG.sync.write(transient))
      }
    },
  })
  expect([...PNG.sync.read(result.bytes).data.subarray(0, 4)]).toEqual([255, 255, 255, 255])
  expect(result.diagnostics).toEqual([])
  expect(browser.contexts()).toHaveLength(0)
})

test('samples distinct browser paints rather than duplicate reads of one frame', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  const result = await capture(browser, server.url, entry, {
    mutate: async page => {
      const original = await page.screenshot()
      const transient = PNG.sync.read(original)
      transient.data.set([255, 0, 255, 255], 0)
      const cached = PNG.sync.write(transient)
      let first = true
      page.screenshot = async () => {
        if (first) {
          first = false
          await page.evaluate(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => { window.paintReady = true }))
          })
        }
        return await page.evaluate(() => window.paintReady === true) ? original : cached
      }
    },
  })
  expect([...PNG.sync.read(result.bytes).data.subarray(0, 4)]).toEqual([255, 255, 255, 255])
})

test('accepts identical pixels even when their PNG encoding changes', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  const result = await capture(browser, server.url, entry, {
    mutate: async page => {
      const original = await page.screenshot()
      const reencoded = PNG.sync.write(PNG.sync.read(original), { deflateLevel: 0 })
      expect(original.equals(reencoded)).toBe(false)
      let alternate = false
      page.screenshot = async () => { alternate = !alternate; return alternate ? original : reencoded }
    },
  })
  expect([...PNG.sync.read(result.bytes).data.subarray(0, 4)]).toEqual([255, 255, 255, 255])
  expect(browser.contexts()).toHaveLength(0)
})

test('rejects continuously changing pixels and releases the browser context', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  await expect(capture(browser, server.url, entry, {
    timeout: 3000,
    mutate: async page => {
      const original = await page.screenshot()
      const changed = PNG.sync.read(original)
      changed.data.set([255, 0, 255, 255], 0)
      const transient = PNG.sync.write(changed)
      let alternate = false
      page.screenshot = async () => { alternate = !alternate; return alternate ? original : transient }
    },
  })).rejects.toThrow('Screenshot did not settle within 3000ms')
  expect(browser.contexts()).toHaveLength(0)
}, 15_000)

test('waits for native buffering controls to finish after a decode error', async () => {
  const entry = { catalog: 'pages', story: 'media--failed', ready: 'text=Unavailable', theme: 'openforge-light', viewport: { width: 480, height: 320 } }
  const result = await capture(browser, server.url, entry, {
    mutate: async page => {
      const session = await page.context().newCDPSession(page)
      const screenshot = page.screenshot.bind(page)
      page.screenshot = async options => {
        const { nodes } = await session.send('Accessibility.getFullAXTree')
        expect(nodes.some(node => !node.ignored && node.role?.value === 'group' && node.name?.value === 'buffering')).toBe(false)
        return screenshot(options)
      }
    },
  })
  expect(result.diagnostics).toEqual([])
  expect(browser.contexts()).toHaveLength(0)
})

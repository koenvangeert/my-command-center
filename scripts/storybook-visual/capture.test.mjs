import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chromium } from 'playwright'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capture, serve } from './capture.mjs'

let browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

async function withCatalog(script, run) {
  const root = await mkdtemp(join(tmpdir(), 'visual-readiness-'))
  let server
  try {
    await mkdir(join(root, 'pages'))
    await writeFile(join(root, 'pages/iframe.html'), `<p id="ready">All changes saved</p><script>${script}</script>`)
    server = await serve(root)
    await run(server.url)
  } finally {
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}

const entry = { catalog: 'pages', story: 'test', theme: 'openforge-light', viewport: { width: 400, height: 200 }, ready: '#ready' }

describe('capture readiness', () => {
  it('waits for play completion even when the ready selector matches before editing begins', async () => {
    await withCatalog(`
      window.__STORYBOOK_PREVIEW__ = { currentRender: { phase: 'playing' } };
      setTimeout(() => {
        document.querySelector('#ready').textContent = 'pnpm preview';
        window.__STORYBOOK_PREVIEW__.currentRender.phase = 'finished';
      }, 1200);
    `, async url => {
      await capture(browser, url, entry, { mutate: async page => {
        expect(await page.locator('#ready').textContent()).toBe('pnpm preview')
      } })
    })
  })

  it('fails readiness rather than accepting a failed play with a visible ready selector', async () => {
    await withCatalog(`window.__STORYBOOK_PREVIEW__ = { currentRender: { phase: 'errored' } };`, async url => {
      await expect(capture(browser, url, entry, { timeout: 1000 })).rejects.toThrow(/missing readiness/)
    })
  })
})

it.each([[undefined, 30000], [3000, 3000]])('uses the capture deadline %s and releases a failed navigation', async (timeout, expected) => {
  const page = {
    setDefaultTimeout: vi.fn(),
    on: vi.fn(),
    clock: { setFixedTime: vi.fn() },
    goto: vi.fn().mockRejectedValue(new Error('load failed')),
  }
  const context = { route: vi.fn(), newPage: vi.fn().mockResolvedValue(page), close: vi.fn() }
  const browser = { newContext: vi.fn().mockResolvedValue(context) }
  const entry = { catalog: 'pages', story: 'example', theme: 'openforge-light', viewport: { width: 1280, height: 800 } }
  await expect(capture(browser, 'http://localhost', entry, { timeout })).rejects.toThrow('load failed')
  expect(page.goto).toHaveBeenCalledWith(expect.any(String), { waitUntil: 'networkidle', timeout: expected })
  expect(page.setDefaultTimeout).toHaveBeenCalledWith(expected)
  expect(context.close).toHaveBeenCalledOnce()
})

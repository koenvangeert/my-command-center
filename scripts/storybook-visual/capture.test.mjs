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

const entry = {
  catalog: 'components', story: 'components-probe--ready', theme: 'openforge-light',
  viewport: { width: 480, height: 240 }, ready: '#ready', expectedErrors: [],
}

function browserFixture(frames) {
  const page = {
    setDefaultTimeout: vi.fn(), on: vi.fn(),
    clock: { setFixedTime: vi.fn(), pauseAt: vi.fn(), runFor: vi.fn() },
    goto: vi.fn(), waitForFunction: vi.fn(),
    locator: () => ({ first: () => ({ waitFor: vi.fn() }) }),
    evaluate: vi.fn(), addStyleTag: vi.fn(), waitForTimeout: vi.fn(),
    screenshot: vi.fn(async () => Buffer.from(frames.length > 1 ? frames.shift() : frames[0])),
  }
  const context = { route: vi.fn(), newPage: async () => page, close: vi.fn() }
  return { browser: { newContext: async () => context }, page, context }
}

describe('visual capture boundary', () => {
  it('flushes a deferred blur repaint before comparing canvas frames', async () => {
    const { browser, page } = browserFixture(['unused'])
    let blurred = false
    let pendingPaint = 0
    let painted = 'focused cursor'
    const input = { blur() { if (!blurred) { blurred = true; pendingPaint = 32 } } }
    vi.stubGlobal('window', { __STORYBOOK_PREVIEW__: { currentRender: { phase: 'finished' } } })
    vi.stubGlobal('document', {
      fonts: { ready: Promise.resolve() },
      querySelectorAll: selector => selector === '.xterm-helper-textarea' ? [input] : [],
    })
    page.evaluate.mockImplementation((fn, arg) => fn(arg))
    page.clock.runFor.mockImplementation(async ms => {
      if (pendingPaint > 0) {
        pendingPaint = Math.max(0, pendingPaint - ms)
        if (pendingPaint === 0) painted = 'unfocused cursor'
      }
    })
    page.screenshot.mockImplementation(async () => Buffer.from(painted))
    try {
      const result = await capture(browser, 'http://localhost:6006', entry)
      expect(result.bytes.toString()).toBe('unfocused cursor')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('waits for consecutive identical painted frames instead of returning the first canvas image', async () => {
    const { browser, page, context } = browserFixture(['empty canvas', 'terminal replay', 'terminal replay'])
    const result = await capture(browser, 'http://localhost:6006', entry)
    expect(result.bytes.toString()).toBe('terminal replay')
    expect(page.screenshot).toHaveBeenCalledTimes(3)
    expect(page.clock.pauseAt).toHaveBeenCalledWith(new Date('2026-01-02T09:30:00.000Z'))
    expect(page.clock.runFor).toHaveBeenCalledTimes(3)
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('rejects unsettled output and still releases the browser context', async () => {
    const { browser, page, context } = browserFixture(['unused'])
    let frame = 0
    page.screenshot.mockImplementation(async () => Buffer.from(String(frame++)))
    await expect(capture(browser, 'http://localhost:6006', entry, { timeout: 10 })).rejects.toThrow('visual state did not settle')
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('rejects failed story interactions before taking a screenshot', async () => {
    const { browser, page, context } = browserFixture(['unused'])
    page.evaluate.mockResolvedValue('errored')
    await expect(capture(browser, 'http://localhost:6006', entry)).rejects.toThrow('story interaction failed')
    expect(page.screenshot).not.toHaveBeenCalled()
    expect(context.close).toHaveBeenCalledOnce()
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
  expect(page.goto).toHaveBeenCalledWith(expect.any(String), { waitUntil: 'domcontentloaded', timeout: expected })
  expect(page.setDefaultTimeout).toHaveBeenCalledWith(expected)
  expect(context.close).toHaveBeenCalledOnce()
})

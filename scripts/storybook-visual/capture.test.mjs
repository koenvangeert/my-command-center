import { expect, it, vi } from 'vitest'
import { capture } from './capture.mjs'

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

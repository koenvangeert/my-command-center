// @vitest-environment node
import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { chromium, type Browser } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createOpenForgePluginSdkSourceAliasRecord } from '../vite'

let server: ViteDevServer
let browser: Browser
let origin: string

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve(import.meta.dirname, '../../../..'),
    plugins: [svelte()],
    resolve: { alias: createOpenForgePluginSdkSourceAliasRecord(new URL('../../../../', import.meta.url)) },
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

it('selects the End-focused item after rapid keyboard reopen without late autofocus stealing it', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${origin}packages/plugin-sdk/src/ui/browser/anchored-menu.html`)
    const trigger = page.getByRole('button', { name: 'Report actions' })
    await trigger.waitFor()
    await page.keyboard.press('Tab')
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Enter')
      await page.keyboard.press('End')
      expect(await page.getByRole('menuitem', { name: 'Delete report' }).evaluate((node) => node === document.activeElement)).toBe(true)
      await page.keyboard.press('Enter')
      expect(await page.getByRole('status', { name: 'Selected action' }).textContent()).toBe('delete')
      expect(await page.getByRole('status', { name: 'Selection count' }).textContent()).toBe(String(attempt))
      expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true)
    }
  } finally {
    await page.close()
  }
}, 30_000)

it('skips disabled items on keyboard, pointer, and controlled opening and restores focus on Escape', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${origin}packages/plugin-sdk/src/ui/browser/anchored-menu.html`)
    const trigger = page.getByRole('button', { name: 'Report actions' })
    await trigger.waitFor()
    await page.keyboard.press('Tab')
    for (const method of ['ArrowDown', 'Space', 'pointer', 'controlled']) {
      if (method === 'pointer') await trigger.click()
      else if (method === 'controlled') await page.getByRole('button', { name: 'Open actions externally' }).click()
      else await page.keyboard.press(method)
      await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()), { message: method }).toBe('Open report')
      await page.keyboard.press('ArrowDown')
      expect(await page.getByRole('menuitem', { name: 'Delete report' }).evaluate((node) => node === document.activeElement)).toBe(true)
      await page.keyboard.press('Home')
      expect(await page.getByRole('menuitem', { name: 'Open report', exact: true }).evaluate((node) => node === document.activeElement)).toBe(true)
      await page.keyboard.press('Escape')
      await page.getByRole('menu').waitFor({ state: 'hidden' })
      expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true)
    }
  } finally {
    await page.close()
  }
})

it('keeps a persistent checkbox menu usable when the focused item is removed, including the empty menu', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${origin}packages/plugin-sdk/src/ui/browser/anchored-menu.html`)
    const trigger = page.getByRole('button', { name: 'Remove reports' })
    await trigger.click()
    await expect.poll(() => page.getByRole('menuitemcheckbox', { name: 'Remove first report' }).evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('ArrowDown')
    expect(await page.getByRole('menuitemcheckbox', { name: 'Remove second report' }).evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('Enter')
    expect(await page.getByRole('menuitemcheckbox', { name: 'Remove third report' }).evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('Enter')
    expect(await page.getByRole('menuitemcheckbox', { name: 'Remove first report' }).evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'Remove reports' })
    expect(await menu.evaluate((node) => node === document.activeElement)).toBe(true)
    expect(await page.getByRole('menuitemcheckbox').count()).toBe(0)
    await page.keyboard.press('Escape')
    expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('Enter')
    expect(await menu.evaluate((node) => node === document.activeElement)).toBe(true)
    await page.keyboard.press('Escape')
    expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true)
  } finally {
    await page.close()
  }
})

// @vitest-environment node
import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { chromium, type Browser } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BUILTIN_THEMES, THEME_TOKEN_CSS_PROPERTIES } from '../themeContract'

let server: ViteDevServer
let browser: Browser
let origin: string

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve(import.meta.dirname, '../../..'),
    plugins: [svelte()],
    optimizeDeps: { entries: ['packages/plugin-sdk/src/ui/browser/index.html'] },
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

const variants = BUILTIN_THEMES.filter((theme) => ['openforge-light', 'openforge-dark', 'workshop-light', 'workshop-dark'].includes(theme.id))

describe.each(variants)('$label mounted controls', (theme) => {
  it('preserves keyboard focus, interaction states, and reduced motion', async () => {
    const page = await browser.newPage({ reducedMotion: 'no-preference' })
    try {
      await page.goto(`${origin}packages/plugin-sdk/src/ui/browser/index.html?invalid`)
      await page.getByRole('button', { name: 'Run review', exact: true }).waitFor()
      await page.locator('[data-theme-fixture]').evaluate((element, properties) => {
        element.setAttribute('style', '')
        for (const [name, value] of properties) (element as HTMLElement).style.setProperty(name, value)
      }, Object.entries(theme.tokens).map(([name, value]) => [THEME_TOKEN_CSS_PROPERTIES[name as keyof typeof theme.tokens], value]))
      for (const label of ['Run review', 'Refresh tasks', 'Repository name', 'Review note', 'Include generated files', 'Enable notifications']) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        expect(await focused.getAttribute('aria-label') ?? await focused.evaluate(el => (el as HTMLInputElement).labels?.[0]?.textContent?.trim() || el.textContent?.trim())).toContain(label)
        const outlines = await focused.evaluate(el => {
          const group = el.closest('[role=group]')!
          return [group, ...group.querySelectorAll('*')].some(node => {
            const style = getComputedStyle(node)
            return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
          })
        })
        expect(outlines, label).toBe(true)
      }
      const primary = page.getByRole('button', { name: 'primary Button', exact: true })
      const normal = await primary.evaluate(el => getComputedStyle(el).backgroundColor)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await primary.hover()
      const hover = await primary.evaluate(el => getComputedStyle(el).backgroundColor)
      expect(hover).not.toBe(normal)
      await page.mouse.down()
      const pressed = await primary.evaluate(el => getComputedStyle(el).backgroundColor)
      expect(pressed).not.toBe(hover)
      await page.mouse.up()
      const disabled = page.getByRole('button', { name: 'primary Button disabled', exact: true })
      expect(await disabled.isDisabled()).toBe(true)
      const before = await disabled.evaluate(el => getComputedStyle(el).backgroundColor)
      await disabled.hover()
      expect(await disabled.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(before)
      for (const label of ['Repository name', 'Review note']) {
        expect(await page.getByRole('textbox', { name: label }).getAttribute('aria-invalid')).toBe('true')
      }
      const transitions = await page.locator('[data-theme-fixture]').evaluate(root => [root, ...root.querySelectorAll('*')].flatMap(el => [null, '::before', '::after'].map(pseudo => {
        const s = getComputedStyle(el, pseudo)
        return s.transitionProperty === 'none' || s.transitionDuration.split(',').every(value => parseFloat(value) === 0)
      })))
      expect(transitions.every(Boolean)).toBe(true)
    } finally {
      await page.close()
    }
  }, 30_000)

  it('uses the selected palette and geometry without replacing user input', async () => {
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    try {
      await page.goto(`${origin}packages/plugin-sdk/src/ui/browser/index.html`)
      const field = page.getByRole('textbox', { name: 'Review note' })
      await field.fill('Keep this draft')
      await page.locator('[data-theme-fixture]').evaluate((element, properties) => {
        element.setAttribute('style', '')
        for (const [name, value] of properties) (element as HTMLElement).style.setProperty(name, value)
      }, Object.entries(theme.tokens).map(([name, value]) => [THEME_TOKEN_CSS_PROPERTIES[name as keyof typeof theme.tokens], value]))
      const button = page.getByRole('button', { name: 'Run review', exact: true })
      const paint = await button.evaluate((element) => {
        const style = getComputedStyle(element)
        return { radius: style.borderRadius, background: style.backgroundColor, color: style.color }
      })
      expect(paint.radius).toBe(theme.tokens.radiusControl)
      const colors = await page.evaluate((tokens) => {
        const probe = document.createElement('div')
        document.body.append(probe)
        const normalize = (color: string) => { probe.style.color = color; return getComputedStyle(probe).color }
        const result = { background: normalize(tokens.accent), color: normalize(tokens.onAccent) }
        probe.remove()
        return result
      }, theme.tokens)
      expect(paint).toMatchObject(colors)
      expect(await field.inputValue()).toBe('Keep this draft')
      await button.focus()
      expect(await button.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
    } finally {
      await page.close()
    }
  }, 30_000)
})

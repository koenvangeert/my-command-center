// @vitest-environment node
import { chromium, type Browser, type Locator } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// STORYBOOK_URL=http://localhost:6006 pnpm test storybook/stories/pages/SelfReview.browser.test.ts
const storybookUrl = process.env.STORYBOOK_URL
let browser: Browser
beforeAll(async () => { if (storybookUrl) browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

async function expectReachable(element: Locator) {
  const bounds = await element.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    let left = 0, right = innerWidth, top = 0, bottom = innerHeight
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      const clip = parent.getBoundingClientRect()
      if (style.overflowX !== 'visible') { left = Math.max(left, clip.left); right = Math.min(right, clip.right) }
      if (style.overflowY !== 'visible') { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom) }
    }
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, clipLeft: left, clipRight: right, clipTop: top, clipBottom: bottom }
  })
  expect(bounds.right - bounds.left).toBeGreaterThan(0)
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.clipLeft - 1)
  expect(bounds.right).toBeLessThanOrEqual(bounds.clipRight + 1)
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.clipTop - 1)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.clipBottom + 1)
}

describe.skipIf(!storybookUrl)('Self Review in the production task workspace', () => {
  it.each([900, 1280])('aligns flat attached headers at %spx', async (width) => {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
    try {
      await page.goto(`${storybookUrl}/iframe.html?id=pages-self-review--github-comments&viewMode=story`)
      await page.getByRole('region', { name: 'Feedback panel' }).getByText('Please handle whitespace-only names.', { exact: true }).waitFor()
      const headers = await page.evaluate(() => {
        return ['.diff-viewer-toolbar', '[role="tablist"][aria-label="Review navigation"]', '[aria-label="Diff scroll area"] .sticky', '[aria-label="Feedback panel"] > div'].map(selector => {
          const element = document.querySelector(selector)!
          const rect = element.getBoundingClientRect()
          return { top: rect.top, bottom: rect.bottom, radius: getComputedStyle(element).borderTopLeftRadius }
        })
      })
      expect(headers[0].top).toBe(headers[1].top)
      expect(headers[0].bottom).toBe(headers[1].bottom)
      expect(headers[2].top).toBe(headers[3].top)
      expect(headers[2].bottom).toBe(headers[3].bottom)
      expect(headers.map(header => header.radius)).toEqual(['0px', '0px', '0px', '0px'])
      const card = page.getByRole('region', { name: 'Feedback panel' }).getByRole('button', { name: 'Comment by alex', exact: true })
      expect(await card.evaluate(element => getComputedStyle(element).borderTopLeftRadius)).not.toBe('0px')
      expect(await page.getByRole('tab', { name: 'GitHub comments (1)', exact: true }).evaluate(element => getComputedStyle(element).borderTopLeftRadius)).not.toBe('0px')
    } finally { await page.close() }
  }, 60_000)

  for (const width of [900, 1280, 1600, 1920]) {
    it(`keeps files, code, and review actions visible without workspace scrolling at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
      page.setDefaultTimeout(5_000)
      try {
        await page.goto(`${storybookUrl}/iframe.html?id=pages-self-review--${width === 900 ? 'narrow' : 'populated'}&viewMode=story`, { timeout: 30_000 })
        const diff = page.getByRole('region', { name: 'Code diff panel', exact: true })
        await diff.getByText('Please cover the empty-name case too.', { exact: true }).waitFor()
        await page.evaluate(() => document.fonts.ready)
        const files = page.getByRole('region', { name: 'Changed files panel', exact: true })
        const sidebar = page.getByRole('complementary').first()
        await expectReachable(sidebar)
        expect((await sidebar.boundingBox())!.width).toBe(272)
        await expectReachable(files)
        await expectReachable(diff)
        const diffBounds = (await diff.boundingBox())!
        expect(diffBounds.width).toBeGreaterThanOrEqual(299)
        expect((await files.boundingBox())!.x).toBeGreaterThanOrEqual(diffBounds.x + diffBounds.width - 1)
        const filesTab = page.getByRole('tab', { name: 'Changed files', exact: true })
        const githubTab = page.getByRole('tab', { name: /^GitHub comments/ })
        expect(await filesTab.getAttribute('aria-selected')).toBe('true')
        for (const tab of [filesTab, githubTab]) await expectReachable(tab)
        const bar = page.getByRole('group', { name: 'Review bar', exact: true })
        for (const button of await bar.getByRole('button').all()) await expectReachable(button)
        for (const label of ['Unified diff view', 'Split diff view', 'Search diff']) {
          await expectReachable(diff.getByRole('button', { name: label, exact: true }))
        }
        await diff.getByRole('button', { name: 'Unified diff view', exact: true }).click()
        await expectReachable(diff.getByText('Please cover the empty-name case too.', { exact: true }))
        await diff.getByRole('button', { name: 'Split diff view', exact: true }).click()
        expect(await diff.getByRole('button', { name: 'Split diff view', exact: true }).getAttribute('aria-pressed')).toBe('true')
        const wrap = diff.getByRole('button', { name: /line wrapping/ })
        const wrapBefore = await wrap.getAttribute('aria-pressed')
        await wrap.click()
        expect(await diff.getByRole('button', { name: /line wrapping/ }).getAttribute('aria-pressed')).not.toBe(wrapBefore)
        await diff.getByRole('button', { name: 'Search diff', exact: true }).click()
        const search = diff.getByRole('textbox', { name: 'Search diff text', exact: true })
        await expectReachable(search)
        await search.fill('greet')
        expect(await search.inputValue()).toBe('greet')
        await page.keyboard.press('Escape')
        await search.waitFor({ state: 'hidden' })
        const filter = page.getByRole('searchbox', { name: 'Filter changed files' })
        await expectReachable(filter)
        await filter.fill('greet')
        await filesTab.focus()
        await page.keyboard.press('ArrowRight')
        expect(await githubTab.getAttribute('aria-selected')).toBe('true')
        await expectReachable(page.getByRole('region', { name: 'Feedback panel', exact: true }))
        await bar.getByRole('button', { name: 'Collapse review panel', exact: true }).click()
        expect(await page.getByRole('tablist', { name: 'Review navigation' }).count()).toBe(0)
        const send = bar.getByRole('button', { name: /^Send feedback/ })
        await expectReachable(send)
        await send.focus()
        await page.keyboard.press('Enter')
        const dialog = page.getByRole('dialog', { name: 'Review the prompt before sending to the agent' })
        await dialog.waitFor()
        expect(await dialog.getByRole('textbox').inputValue()).toContain('Please cover the empty-name case too.')
        await expectReachable(dialog.getByRole('button', { name: 'Send to agent', exact: true }))
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        expect(await send.evaluate(element => element === document.activeElement)).toBe(true)
        await bar.getByRole('button', { name: 'Show review panel', exact: true }).click()
        expect(await githubTab.getAttribute('aria-selected')).toBe('true')
        await filesTab.click()
        await expectReachable(files)
        await expectReachable(filter)
        expect((await sidebar.boundingBox())!.width).toBe(272)
      } finally { await page.close() }
    }, 60_000)
  }

  it('sends combined inline and selected GitHub feedback after switching tabs and collapsing', async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 }, reducedMotion: 'reduce' })
    try {
      await page.goto(`${storybookUrl}/iframe.html?id=pages-self-review--linked-pull-request&viewMode=story`, { timeout: 30_000 })
      const github = page.getByRole('tab', { name: 'GitHub comments (1)', exact: true })
      await github.waitFor()
      await expectReachable(github)
      expect(await page.getByRole('tab', { name: 'Changed files', exact: true }).getAttribute('aria-selected')).toBe('true')
      await github.click()
      const feedback = page.getByRole('region', { name: 'Feedback panel', exact: true })
      await expectReachable(feedback)
      await expectReachable(feedback.getByRole('button', { name: 'Select all', exact: true }))
      await feedback.getByRole('button', { name: 'Select all', exact: true }).click()
      await page.getByRole('button', { name: 'Send feedback (2)', exact: true }).waitFor()
      await page.getByRole('tab', { name: 'Changed files', exact: true }).click()
      await page.getByRole('button', { name: 'Collapse review panel', exact: true }).click()
      const send = page.getByRole('button', { name: 'Send feedback (2)', exact: true })
      await expectReachable(send)
      await send.click()
      const dialog = page.getByRole('dialog', { name: 'Review the prompt before sending to the agent' })
      const preview = dialog.getByRole('textbox')
      expect(await preview.inputValue()).toContain('Please cover the empty-name case too.')
      expect(await preview.inputValue()).toContain('Please handle whitespace-only names.')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      await send.click()
      await dialog.getByRole('button', { name: 'Send to agent', exact: true }).click()
      await page.getByText('Feedback sent to agent!', { exact: true }).waitFor()
      expect(await page.getByRole('button', { name: 'Send feedback (0)', exact: true }).isDisabled()).toBe(true)
      await page.getByRole('button', { name: 'Show review panel', exact: true }).waitFor()
    } finally { await page.close() }
  }, 60_000)

  it('constrains saved panel widths across host resizing without losing the preferred width', async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 800 }, reducedMotion: 'reduce' })
    try {
      await page.goto(`${storybookUrl}/iframe.html?id=pages-self-review--populated&viewMode=story`, { timeout: 30_000 })
      const handle = page.getByRole('separator', { name: 'Resize Review panel', exact: true })
      await handle.waitFor()
      await page.getByRole('button', { name: 'Collapse review panel', exact: true }).click()
      await page.evaluate(() => localStorage.setItem('resizable-panel:self-review-side-panel', '500'))
      await page.getByRole('button', { name: 'Show review panel', exact: true }).click()
      await handle.waitFor()
      expect(await handle.getAttribute('aria-valuenow')).toBe('500')
      await page.setViewportSize({ width: 900, height: 800 })
      await page.waitForFunction(() => Number(document.querySelector('[aria-label="Resize Review panel"]')?.getAttribute('aria-valuenow')) <= 256)
      await expectReachable(page.getByRole('region', { name: 'Changed files panel', exact: true }))
      expect((await page.getByRole('region', { name: 'Code diff panel', exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(299)
      await page.setViewportSize({ width: 1920, height: 800 })
      await page.waitForFunction(() => document.querySelector('[aria-label="Resize Review panel"]')?.getAttribute('aria-valuenow') === '500')
      await handle.focus()
      await page.keyboard.press('ArrowRight')
      expect(await handle.getAttribute('aria-valuenow')).toBe('490')
      const bounds = (await handle.boundingBox())!
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 20)
      await page.mouse.down()
      await page.mouse.move(bounds.x + 30, bounds.y + 20)
      await page.mouse.up()
      expect(Number(await handle.getAttribute('aria-valuenow'))).toBeLessThan(490)
    } finally { await page.close() }
  }, 60_000)
})

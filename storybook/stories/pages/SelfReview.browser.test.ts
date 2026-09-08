// @vitest-environment node
import { chromium, type Browser, type Locator } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// STORYBOOK_URL=http://localhost:6006 pnpm test storybook/stories/pages/SelfReview.browser.test.ts
const storybookUrl = process.env.STORYBOOK_URL
let browser: Browser
beforeAll(async () => {
  if (storybookUrl) browser = await chromium.launch({ headless: true })
})
afterAll(async () => { await browser?.close() })

async function expectReachable(element: Locator) {
  const bounds = await element.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    let left = 0
    let right = innerWidth
    let top = 0
    let bottom = innerHeight
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      const clip = parent.getBoundingClientRect()
      if (style.overflowX !== 'visible') {
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      if (style.overflowY !== 'visible') {
        top = Math.max(top, clip.top)
        bottom = Math.min(bottom, clip.bottom)
      }
    }
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, clipLeft: left, clipRight: right, clipTop: top, clipBottom: bottom }
  })
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.clipLeft - 1)
  expect(bounds.right).toBeLessThanOrEqual(bounds.clipRight + 1)
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.clipTop - 1)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.clipBottom + 1)
}

describe.skipIf(!storybookUrl)('Self Review in the production task workspace', () => {
  for (const width of [900, 1280, 1600, 1920]) {
    it(`keeps code and feedback reachable at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
      page.setDefaultTimeout(5_000)
      try {
        await page.goto(`${storybookUrl}/iframe.html?id=pages-self-review--${width === 900 ? 'narrow' : 'populated'}&viewMode=story`)
        const diff = page.getByRole('region', { name: 'Code diff panel', exact: true })
        await diff.waitFor()
        await page.evaluate(() => document.fonts.ready)
        expect((await diff.boundingBox())!.width).toBeGreaterThanOrEqual(540)
        await expectReachable(diff.getByText('Please cover the empty-name case too.', { exact: true }))
        await expectReachable(diff.getByRole('button', { name: 'Toggle Feedback panel' }))
        const navigation = page.getByRole('group', { name: 'Review panels', exact: true })
        for (const control of await navigation.getByRole('button').all()) await expectReachable(control)
        const code = navigation.getByRole('button', { name: 'Code', exact: true })
        await code.focus()
        await page.keyboard.press('Enter')
        await expectReachable(diff.getByText('Please cover the empty-name case too.', { exact: true }))
        await expectReachable(diff.getByRole('button', { name: 'Toggle Feedback panel' }))
        await navigation.getByRole('button', { name: /^Feedback/ }).click()
        const feedback = page.getByRole('region', { name: 'Feedback panel', exact: true })
        await expectReachable(feedback)
        await expectReachable(feedback.getByRole('button', { name: 'Send to agent', exact: true }))
        await feedback.getByRole('button', { name: 'Send to agent', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Review the prompt before sending to the agent' })
        await dialog.waitFor()
        await expectReachable(dialog.getByRole('button', { name: 'Send to agent', exact: true }))
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        await feedback.getByRole('button', { name: 'Collapse Feedback panel', exact: true }).click()
        await navigation.getByRole('button', { name: /^Feedback/ }).click()
        await expectReachable(page.getByRole('region', { name: 'Feedback panel', exact: true }))
        await navigation.getByRole('button', { name: 'Changed files', exact: true }).click()
        await expectReachable(page.getByRole('region', { name: 'Changed files panel', exact: true }))
        await expectReachable(page.getByRole('searchbox', { name: 'Filter changed files' }))
        await page.getByRole('button', { name: 'Collapse Changed files panel', exact: true }).click()
        expect(await page.getByRole('region', { name: 'Changed files panel', exact: true }).count()).toBe(0)
        await navigation.getByRole('button', { name: 'Changed files', exact: true }).click()
        await expectReachable(page.getByRole('region', { name: 'Changed files panel', exact: true }))
        await expectReachable(page.getByRole('searchbox', { name: 'Filter changed files' }))
      } finally {
        await page.close()
      }
    }, 30_000)
  }
})

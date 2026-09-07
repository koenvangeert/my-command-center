// @vitest-environment node
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// STORYBOOK_URL=http://localhost:6007 pnpm test storybook/stories/components/ProjectSidebarList.browser.test.ts
const storybookUrl = process.env.STORYBOOK_URL
let browser: Browser
beforeAll(async () => { if (storybookUrl) browser = await chromium.launch() })
afterAll(async () => { await browser?.close() })

describe.skipIf(!storybookUrl)('Project sidebar action bounds', () => {
  for (const theme of ['dark', 'light']) {
    it(`contains first, middle and last project actions in ${theme}`, async () => {
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' })
      try {
        await page.goto(`${storybookUrl}/iframe.html?id=components-host-chrome-project-list--expanded&viewMode=story&globals=openforgeTheme:openforge-${theme}`)
        await page.getByRole('button', { name: 'Hidden (1)', exact: true }).click()
        await page.getByRole('button', { name: 'Unhide Archived experiments', exact: true }).click()
        const list = page.locator('.project-sidebar-list')
        await list.evaluate(element => { element.style.width = '240px' })
        const rows = page.locator('.project-row')
        await expect.poll(() => rows.count()).toBe(3)
        for (const row of await rows.all()) {
          await row.hover()
          const actions = row.locator('.project-actions')
          await expect.poll(() => actions.evaluate(el => getComputedStyle(el).opacity)).toBe('1')
          for (const button of await actions.getByRole('button').all()) {
            await button.focus()
            const bounds = await button.evaluate(el => {
              const b = el.getBoundingClientRect()
              const r = el.closest('.project-row')!.getBoundingClientRect()
              return { top: b.top - r.top, bottom: r.bottom - b.bottom, left: b.left - r.left, right: r.right - b.right, width: b.width, height: b.height }
            })
            for (const edge of ['top', 'bottom', 'left', 'right'] as const) expect(bounds[edge], JSON.stringify(bounds)).toBeGreaterThanOrEqual(0)
            expect(bounds.width).toBeGreaterThanOrEqual(24)
            expect(bounds.height).toBeGreaterThanOrEqual(24)
          }
        }
        const names = () => rows.locator('.expanded-project-button').evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')))
        await page.getByRole('button', { name: 'Move OpenForge down', exact: true }).focus()
        await page.keyboard.press('Enter')
        await expect.poll(names).toEqual(['Documentation and contributor onboarding', 'OpenForge', 'Archived experiments'])
        await page.getByRole('button', { name: 'Move OpenForge up', exact: true }).click()
        await expect.poll(names).toEqual(['OpenForge', 'Documentation and contributor onboarding', 'Archived experiments'])
        await page.getByRole('button', { name: 'Hide OpenForge', exact: true }).click()
        await expect.poll(() => rows.count()).toBe(2)
        await page.getByRole('button', { name: 'Unhide OpenForge', exact: true }).click()
        await expect.poll(() => rows.count()).toBe(3)
      } finally { await page.close() }
    }, 30_000)
  }
})

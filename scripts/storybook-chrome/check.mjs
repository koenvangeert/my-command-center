import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { serve } from '../storybook-visual/capture.mjs'

// Run after both catalog builds. Exercise public Storybook completion events and
// rendered controls, including a second render in the same browser document.
const root = resolve(import.meta.dirname, '../..')
const server = await serve(resolve(root, 'storybook-static'))
const browser = await chromium.launch({ headless: true })
let checked = 0
try {
  for (const catalog of ['pages', 'components']) {
    const index = JSON.parse(await readFile(resolve(root, `storybook-static/${catalog}/index.json`), 'utf8'))
    const stories = Object.values(index.entries).filter(entry => entry.type === 'story' && (
      entry.title === 'Application/Shell' || /^Components\/(Host Chrome|Host Controls|Feedback)\//.test(entry.title)
    ))
    assert.ok(stories.length, `No host chrome stories in ${catalog}`)
    for (const story of stories) {
      if (process.argv[2] && !story.id.includes(process.argv[2])) continue
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
      const diagnostics = []
      await context.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort())
      const page = await context.newPage()
      page.on('pageerror', error => diagnostics.push(error.message))
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()) })
      try {
        await page.goto(`${server.url}/${catalog}/iframe.html?id=${catalog}-catalog-ready--ready&viewMode=story`, { waitUntil: 'networkidle' })
        await page.waitForFunction(() => !!window.__STORYBOOK_ADDONS_CHANNEL__)
        await page.evaluate(() => {
          window.__chromeResults = []
          window.__STORYBOOK_ADDONS_CHANNEL__.on('storyFinished', result => window.__chromeResults.push(result))
        })
        for (let repeat = 0; repeat < 2; repeat++) {
          await page.evaluate(({ id, repeat }) => {
            window.__chromeResults = []
            window.__STORYBOOK_ADDONS_CHANNEL__.emit(repeat === 0 ? 'setCurrentStory' : 'forceRemount', { storyId: id, viewMode: 'story' })
          }, { id: story.id, repeat })
          await page.waitForFunction(() => window.__chromeResults?.length > 0, null, { timeout: 15000 })
          const results = await page.evaluate(() => window.__chromeResults)
          assert.ok(results.every(result => result.status === 'success'), `${story.id}: ${JSON.stringify(results)}`)
          if (story.id === 'application-shell--zen') {
            assert.equal(await page.getByRole('button', { name: /^(Collapse|Expand) sidebar$/ }).count(), 0)
            assert.equal(await page.getByRole('navigation', { name: 'Project tools' }).count(), 0)
          }
          if (story.id === 'application-shell--quit-confirmation') {
            const dialog = await page.getByRole('dialog', { name: 'Agents still running' }).boundingBox()
            assert.ok(dialog && Math.abs(dialog.x + dialog.width / 2 - 640) < 2, 'dialog must center in the viewport, not remaining page content')
          }
          if (story.id === 'application-shell--error-feedback') {
            const toast = await page.getByRole('alert').boundingBox()
            assert.ok(toast && toast.y + toast.height <= 800 && toast.x + toast.width <= 1280, 'feedback must remain inside the application viewport')
          }
          assert.deepEqual(diagnostics, [], `${story.id}: unexpected diagnostics`)
          if (repeat === 0) {
            await page.evaluate(() => localStorage.setItem('resizable-panel:storybook-host-chrome', '399'))
            if (story.id === 'application-shell--expanded') {
              await page.getByRole('button', { name: 'Collapse sidebar' }).click()
              await page.getByRole('button', { name: 'Documentation and contributor onboarding' }).click()
            }
            if (story.id === 'application-shell--open-close-dialogs') {
              await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
              await page.getByRole('dialog', { name: 'Keyboard Shortcuts' }).waitFor()
            }
          } else {
            assert.equal(await page.evaluate(() => localStorage.getItem('resizable-panel:storybook-host-chrome')), null, `${story.id}: stale layout storage`)
            if (story.id === 'application-shell--expanded') {
              await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor()
              await page.getByRole('heading', { name: 'OpenForge', exact: true }).waitFor()
              assert.equal(await page.getByRole('dialog').count(), 0, 'stale dialog after rerender')
            }
            if (story.id === 'components-host-controls-bottom-panel--default') {
              assert.equal(await page.getByTestId('resizable-bottom-panel').evaluate(element => element.style.height), '220px')
            }
          }
        }
        console.log(`PASS ${story.id}: two same-document renders`)
        checked++
      } catch (error) {
        throw new Error(`${story.id}: ${error.message}\n${diagnostics.join('\n')}\n${await page.locator('body').innerText()}`, { cause: error })
      } finally {
        await context.close()
      }
    }
  }
  assert.ok(checked > 0, 'No stories matched the requested check')
  console.log(`Checked ${checked} host chrome stories without unexpected diagnostics.`)
} finally {
  await browser.close()
  await server.close()
}

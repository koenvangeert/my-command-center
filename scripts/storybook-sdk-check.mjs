import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { serve } from './storybook-visual/capture.mjs'

// Run after both catalog builds. Exercise Storybook's channel and rendered UI,
// including a second render in the same document rather than a fresh navigation.
const server = await serve('storybook-static')
const browser = await chromium.launch({ headless: true })
let checked = 0
try {
  for (const catalog of ['components', 'pages']) {
    const index = JSON.parse(await readFile(`storybook-static/${catalog}/index.json`, 'utf8'))
    const stories = Object.keys(index.entries).filter(id => id.startsWith(catalog === 'pages' ? 'pages-sdk-' : 'sdk-'))
    assert.ok(stories.length, `No SDK stories in ${catalog}; build both catalogs first`)
    const context = await browser.newContext({ viewport: { width: 900, height: 640 }, reducedMotion: 'reduce' })
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(server.url).origin ? route.continue() : route.abort())
    const page = await context.newPage()
    const diagnostics = []
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()) })
    page.on('pageerror', error => diagnostics.push(error.message))
    await page.goto(`${server.url}/${catalog}/iframe.html?id=${catalog}-catalog-ready--ready&viewMode=story`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__STORYBOOK_ADDONS_CHANNEL__))
    for (const id of stories) {
      for (const event of ['setCurrentStory', 'forceRemount']) {
        await page.evaluate(({ id, event }) => {
          const channel = window.__STORYBOOK_ADDONS_CHANNEL__
          window.sdkFinished = null
          const finished = result => {
            if (result.storyId !== id) return
            window.sdkFinished = result
            channel.off('storyFinished', finished)
          }
          channel.on('storyFinished', finished)
          channel.emit(event, { storyId: id, viewMode: 'story' })
        }, { id, event })
        await page.waitForFunction(() => window.sdkFinished, undefined, { timeout: 15000 })
        const result = await page.evaluate(() => window.sdkFinished)
        assert.equal(result.status, 'success', `${id} ${event}: ${JSON.stringify(result)}`)
        assert.deepEqual(diagnostics, [], `${id}: unexpected diagnostics`)
        checked++
      }
      console.log(`PASS ${id} and same-document remount`)
    }
    if (catalog === 'components') {
      await page.evaluate(() => window.__STORYBOOK_ADDONS_CHANNEL__.emit('setCurrentStory', { storyId: 'sdk-file-workspace--populated', viewMode: 'story' }))
      const handle = page.getByRole('separator', { name: 'Resize files panel' })
      await handle.waitFor()
      const box = await handle.boundingBox()
      assert.ok(box)
      await page.mouse.move(box.x + box.width / 2, box.y + 40)
      await page.mouse.down()
      await page.mouse.move(box.x + 80, box.y + 40)
      await page.mouse.up()
      assert.ok(Number(await handle.getAttribute('aria-valuenow')) > 240, 'Pointer drag grows the panel')
      await handle.dblclick()
      assert.equal(await handle.getAttribute('aria-valuenow'), '240', 'Double click resets width')
      await handle.press('ArrowRight')
      await page.evaluate(() => window.__STORYBOOK_ADDONS_CHANNEL__.emit('forceRemount', { storyId: 'sdk-file-workspace--populated' }))
      await page.waitForFunction(() => document.querySelector('[role="separator"]')?.getAttribute('aria-valuenow') === '240')
      assert.deepEqual(diagnostics, [], 'Pointer resize diagnostics')
    }
    await context.close()
  }
  console.log(`SDK catalog checks passed: ${checked} renders, pointer resize, persisted-width reset`)
} finally {
  await browser.close()
  await server.close()
}

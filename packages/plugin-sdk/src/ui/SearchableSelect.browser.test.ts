// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { chromium, type Browser } from 'playwright'
import { build, preview, type PreviewServer } from 'vite'
import { afterAll, beforeAll, expect, it } from 'vitest'

let root: string
let server: PreviewServer
let browser: Browser

beforeAll(async () => {
  const sdk = resolve(import.meta.dirname, '../..')
  root = await mkdtemp(resolve(sdk, '.searchable-select-browser-'))
  // Build an isolated package so parallel suites cannot delete each other's dist.
  const isolatedSdk = resolve(root, 'node_modules/@openforge-app/plugin-sdk')
  await mkdir(isolatedSdk, { recursive: true })
  for (const entry of ['src', 'scripts', 'package.json', 'tsconfig.json']) {
    await cp(resolve(sdk, entry), resolve(isolatedSdk, entry), { recursive: true })
  }
  // Registry checks require the monorepo layout; run the package's artifact steps here.
  execFileSync('pnpm', ['exec', 'tsc'], { cwd: isolatedSdk, stdio: 'pipe' })
  execFileSync('pnpm', ['build:assets'], { cwd: isolatedSdk, stdio: 'pipe' })
  await writeFile(resolve(root, 'package.json'), JSON.stringify({ name: 'external-select-fixture', type: 'module' }))
  // Resolve the public, built SDK export. No source aliases, Tailwind, or host reset.
  await writeFile(resolve(root, 'index.html'), '<div id="app"></div><script type="module" src="/main.ts"></script>')
  await writeFile(resolve(root, 'main.ts'), `import { mount } from 'svelte'; import App from './App.svelte'; mount(App, { target: document.getElementById('app')! });`)
  await writeFile(resolve(root, 'App.svelte'), `<script>
    import SearchableSelect from '@openforge-app/plugin-sdk/ui/SearchableSelect.svelte';
    let value = $state('0');
    let clicks = $state(0);
    const options = Array.from({ length: 40 }, (_, i) => ({ value: String(i), label: i === 0 ? 'Long project label '.repeat(20) : 'Project ' + i, badge: 'Active' }));
  </script>
  <main style="width: 260px; margin: 24px">
    <SearchableSelect {options} {value} ariaLabel="Project" onSelect={(next) => value = next} />
  </main>
  <button style="position:fixed;bottom:24px;right:24px" onclick={() => clicks++}>Outside {clicks}</button>
  <style>
    :global(:root) {
      --of-space1: 4px; --of-space2: 8px; --of-space3: 12px;
      --of-border-width: 1px; --of-border-interactive: #777; --of-border-strong: #777; --of-border: #aaa;
      --of-radius-control: 4px; --of-radius-overlay: 6px; --of-radius-round: 99px;
      --of-field: white; --of-text: #111; --of-text-muted: #666; --of-surface-raised: white;
      --of-font-sans: sans-serif; --of-text-sm: 14px; --of-text-xs: 12px; --of-line-height-xs: 16px;
      --of-control-height: 32px; --of-control-height-compact: 24px;
      --of-accent: blue; --of-on-accent: white; --of-status-neutral: #777;
    }
  </style>`)
  await build({ configFile: false, root, plugins: [svelte()], logLevel: 'error' })
  server = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port: 0 } })
  browser = await chromium.launch({ headless: true })
}, 60_000)

afterAll(async () => {
  try { await browser?.close() } finally {
    try { await new Promise<void>((resolve, reject) => server ? server.httpServer.close(error => error ? reject(error) : resolve()) : resolve()) }
    finally { if (root) await rm(root, { recursive: true, force: true }) }
  }
})

it('intercepts outside clicks before they reach underlying controls', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(server.resolvedUrls.local[0])
    await page.getByRole('combobox').click()
    await page.getByRole('listbox').waitFor()
    const outside = await page.getByRole('button', { name: 'Outside 0' }).boundingBox()
    await page.mouse.click(outside!.x + 5, outside!.y + 5)
    await page.getByRole('listbox').waitFor({ state: 'hidden' })
    expect(await page.getByRole('button').textContent()).toBe('Outside 0')
  } finally { await page.close() }
})

it('bounds results and scrolls to keyboard-highlighted options', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(server.resolvedUrls.local[0])
    await page.getByRole('combobox').click()
    const list = page.getByRole('listbox')
    const bounds = await list.evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }))
    expect(bounds.height).toBeLessThanOrEqual(208)
    expect(bounds.content).toBeGreaterThan(bounds.height)
    for (let i = 0; i < 39; i++) await page.keyboard.press('ArrowDown')
    expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press('Enter')
    expect(await page.getByRole('combobox').textContent()).toContain('Project 39')
  } finally { await page.close() }
})

it('truncates long labels while keeping badges within the trigger and options', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(server.resolvedUrls.local[0])
    await page.getByRole('combobox').click()
    for (const container of [page.getByRole('combobox'), page.getByRole('option').first()]) {
      const layout = await container.evaluate(el => {
        const label = [...el.querySelectorAll('span')].find(span => span.childElementCount === 0 && span.textContent?.startsWith('Long project'))!
        const badge = el.querySelector('[data-variant]')!
        const outer = el.getBoundingClientRect()
        const text = label.getBoundingClientRect()
        const pill = badge.getBoundingClientRect()
        return { truncated: label.scrollWidth > label.clientWidth, ellipsis: getComputedStyle(label).textOverflow,
          contained: pill.right <= outer.right && text.right <= pill.left, sameRow: Math.abs(text.y - pill.y) < pill.height }
      })
      expect(layout).toEqual({ truncated: true, ellipsis: 'ellipsis', contained: true, sameRow: true })
    }
  } finally { await page.close() }
})

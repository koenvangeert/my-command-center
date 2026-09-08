import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serve } from './capture.mjs'

vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal()
  return { ...fs, readFile: vi.fn(fs.readFile) }
})

let root, server, diagnostics
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'visual-server-'))
  await writeFile(join(root, 'asset.js'), 'export default 42')
  diagnostics = vi.spyOn(console, 'error').mockImplementation(() => {})
  server = await serve(root)
})
afterEach(async () => {
  await server?.close()
  await rm(root, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.mocked(readFile).mockClear()
})

it.each(['EACCES', 'EIO'])('reports an unexpected %s read failure as HTTP 500 and keeps serving', async code => {
  const error = Object.assign(new Error(`${code}: cannot read asset`), { code })
  vi.mocked(readFile).mockRejectedValueOnce(error)
  const response = await fetch(`${server.url}/asset.js`)
  expect(response.status).toBe(500)
  expect(await response.text()).toBe('Internal server error')
  expect(diagnostics).toHaveBeenCalledWith(expect.stringContaining(join(root, 'asset.js')), error)
  expect(diagnostics.mock.calls[0][0]).toContain('/asset.js')

  const recovered = await fetch(`${server.url}/asset.js`)
  expect(recovered.status).toBe(200)
  expect(recovered.headers.get('content-type')).toBe('text/javascript')
  expect(await recovered.text()).toBe('export default 42')
})

it.each(['/missing.js', '/asset.js/child'])('returns a quiet 404 for missing file %s', async path => {
  const response = await fetch(`${server.url}${path}`)
  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not found')
  expect(diagnostics).not.toHaveBeenCalled()
})

it.each(['/', '/%zz', '/%00', '/..%2Fsecret.txt', '/..%2Fstatic-sibling/secret.txt'])('rejects invalid or outside-root request %s before reading', async path => {
  const response = await fetch(`${server.url}${path}`)
  expect(response.status).toBe(404)
  expect(await response.text()).toBe('Not found')
  expect(readFile).not.toHaveBeenCalled()
  expect(diagnostics).not.toHaveBeenCalled()
})

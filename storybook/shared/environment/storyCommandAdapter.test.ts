import { afterEach, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { executePluginCommand } from '../../../src/lib/plugin/pluginCommandExecution'
import { runtimeContributionSources } from '../../../src/lib/plugin/pluginStore'
import { createStoryCommandAdapter } from './storyCommandAdapter'

const disposals: Array<() => void | Promise<void>> = []
afterEach(async () => { for (const dispose of disposals.splice(0).reverse()) await dispose() })

it('registers only local commands, resets their registrations, and releases them between scenarios', async () => {
  const firstHandler = vi.fn()
  const first = createStoryCommandAdapter('story.command-test', [{ id: 'open', title: 'Open', handler: firstHandler }])
  disposals.push(() => first.dispose())
  await first.install()
  await expect(executePluginCommand('story.command-test', 'open', { path: 'first.ts' })).resolves.toBe(true)
  expect(firstHandler).toHaveBeenCalledWith({ path: 'first.ts' })
  await first.reset()
  await executePluginCommand('story.command-test', 'open', { path: 'reset.ts' })
  expect(firstHandler).toHaveBeenCalledTimes(2)
  await first.dispose()
  expect(get(runtimeContributionSources).has('story.command-test')).toBe(false)

  const nextHandler = vi.fn()
  const next = createStoryCommandAdapter('story.command-test', [{ id: 'open', title: 'Open', handler: nextHandler }])
  disposals.push(() => next.dispose())
  await next.install()
  await executePluginCommand('story.command-test', 'open', { path: 'next.ts' })
  expect(firstHandler).toHaveBeenCalledTimes(2)
  expect(nextHandler).toHaveBeenCalledWith({ path: 'next.ts' })
})

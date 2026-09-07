import { get } from 'svelte/store'
import { afterEach, expect, it } from 'vitest'
import { clearCollapsedSections, collapsedSections, setSectionCollapsed } from '../../../packages/plugin-sdk/src/collapsibleSectionState'
import { createStorySectionAdapter } from './storySectionAdapter'

afterEach(() => clearCollapsedSections())

it('starts each render with its section state and restores the host state on disposal', () => {
  setSectionCollapsed('host', true)
  const adapter = createStorySectionAdapter(['plugin:catalog:details'])
  adapter.install()
  expect(get(collapsedSections)).toEqual({ 'plugin:catalog:details': true })
  setSectionCollapsed('plugin:catalog:details', false)
  setSectionCollapsed('interactive', true)
  adapter.reset()
  expect(get(collapsedSections)).toEqual({ 'plugin:catalog:details': true })
  adapter.dispose()
  adapter.dispose()
  expect(get(collapsedSections)).toEqual({ host: true })
})

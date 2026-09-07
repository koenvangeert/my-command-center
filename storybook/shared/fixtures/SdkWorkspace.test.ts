import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, expect, it } from 'vitest'
import SdkWorkspace from './SdkWorkspace.svelte'
import { createStoryEnvironment } from '../environment/storyEnvironment'
import { createStoryStorageAdapter } from '../environment/storyStorageAdapter'

afterEach(cleanup)

it('selects repository files and resets persisted panel width for the next render', async () => {
  const environment = createStoryEnvironment({ id: 'workspace', now: 0, adapters: [createStoryStorageAdapter(localStorage)] })
  await environment.install()
  try {
    const first = render(SdkWorkspace)
    await fireEvent.click(screen.getByRole('treeitem', { name: /README.md/ }))
    expect(screen.getByRole('heading', { name: 'Repository guide' })).toBeVisible()
    const handle = screen.getByRole('separator', { name: 'Resize files panel' })
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle).toHaveAttribute('aria-valuenow', '250')
    first.unmount()
    await environment.reset()
    render(SdkWorkspace)
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '240')
    expect(screen.getByText('Select a file to preview')).toBeVisible()
  } finally {
    cleanup()
    await environment.dispose()
  }
})

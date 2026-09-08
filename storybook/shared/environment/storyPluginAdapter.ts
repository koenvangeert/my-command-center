import type {
  OpenForgeContextSnapshot,
  TaskBrowserSurfaceState,
} from '@openforge-app/plugin-sdk/frontend'
import {
  createOpenForgeRegistryFake,
  type MockFrontendOpenForgeAPI,
  type TestingOpenForgeApiCalls,
  type TestingOpenForgeApiOptions,
  type TestingOpenForgeRegistryFake,
} from '@openforge-app/plugin-sdk/testing'
import type { StoryEnvironmentAdapter } from './storyEnvironment'
import { createStoryFileSystem, type StoryFileSystemDefinition } from './storyFileSystem'

export type StoryPluginDefinition = Omit<TestingOpenForgeApiOptions, 'storage'> & {
  filesystem?: StoryFileSystemDefinition
}

export interface StoryPluginAdapter extends StoryEnvironmentAdapter {
  readonly api: MockFrontendOpenForgeAPI
  readonly context: OpenForgeContextSnapshot
  readonly calls: TestingOpenForgeApiCalls
  releaseFilesystem(key: string): void
  setBrowserSurfaceState(
    taskId: string,
    id: string,
    patch: Partial<TaskBrowserSurfaceState>,
  ): void
}

export function createStoryPluginAdapter(
  definition: StoryPluginDefinition = {},
): StoryPluginAdapter {
  let filesystem: ReturnType<typeof createStoryFileSystem> | undefined
  function createRegistry(): TestingOpenForgeRegistryFake {
    const { filesystem: definitionFs, ...options } = structuredClone(definition)
    const result = createOpenForgeRegistryFake(options)
    filesystem = definitionFs ? createStoryFileSystem(definitionFs, result.frontendApi.fs) : undefined
    if (filesystem) result.frontendApi.fs = filesystem.fs
    return result
  }
  let registry = createRegistry()
  let installed = false
  let disposed = false

  function install(): void {
    if (disposed) throw new Error('Disposed story plugin adapter cannot be installed')
    installed = true
  }

  async function reset(): Promise<void> {
    if (!installed || disposed) throw new Error('Story plugin adapter must be installed before reset')
    filesystem?.dispose()
    await registry.disposeAll()
    registry = createRegistry()
  }

  function setBrowserSurfaceState(
    taskId: string,
    id: string,
    patch: Partial<TaskBrowserSurfaceState>,
  ): void {
    registry.setBrowserSurfaceState(taskId, id, patch)
  }

  async function dispose(): Promise<void> {
    if (disposed) return
    disposed = true
    filesystem?.dispose()
    if (installed) await registry.disposeAll()
    installed = false
  }

  return Object.freeze({
    get api() {
      return registry.frontendApi
    },
    get context() {
      return registry.frontendApi.context.getSnapshot()
    },
    get calls() {
      return registry.calls
    },
    install,
    reset,
    releaseFilesystem(key: string) { filesystem?.release(key) },
    setBrowserSurfaceState,
    dispose,
  })
}

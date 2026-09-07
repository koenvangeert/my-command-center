import * as stores from '../../../src/lib/stores'
import { resetHistory } from '../../../src/lib/router.svelte'
import { enabledPluginIds, installedPlugins, runtimeContributionSources } from '../../../src/lib/plugin/pluginStore'
import { FILE_VIEWER_PLUGIN_ID } from '../../../src/lib/fileViewerView'
import { setConfig } from '../../../src/lib/ipc'
import { createStoryCommandAdapter } from '../environment/storyCommandAdapter'
import { createStoryStoreAdapter as seed } from '../environment/storyStoreAdapter'
import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import { boardScenario } from './boardScenario'
import { createProject, createTask } from './appFixtures'

export type NavigationWorkflowKind = 'projects' | 'commands' | 'actions' | 'files'

export function navigationScenario(workflow: NavigationWorkflowKind, state = 'populated'): StoryScenarioDefinition {
  const board = boardScenario()
  const projects = state === 'empty' && workflow === 'projects' ? [] : [
    createProject(),
    createProject({ id: 'project-2', name: 'Docs', path: '/workspace/docs' }),
    createProject({ id: 'project-3', name: 'Terminal', path: '/workspace/terminal' }),
  ]
  if (workflow === 'projects' && state === 'overflow') for (let i = 4; i <= 24; i++) projects.push(createProject({
    id: `project-${i}`, name: `Integration ${i}: a long project name for checking truncated results`,
    path: `/workspace/integrations/long-repository-path/integration-${i}`,
  }))
  if (state === 'attention') projects.push(
    createProject({ id: 'project-4', name: 'CI examples', path: '/workspace/ci' }),
    createProject({ id: 'project-5', name: 'Review examples', path: '/workspace/reviews' }),
  )
  const tasks = state === 'empty' ? [] : [
    createTask({ prompt: 'Review keyboard navigation' }),
    createTask({ id: 'T-43', projectId: 'project-2', prompt: 'Write contributor docs', status: 'backlog' }),
  ]
  if (workflow === 'commands' && state === 'overflow') for (let i = 0; i < 30; i++) tasks.push(createTask({
    id: `T-${100 + i}`, prompt: `Review integration ${i}: preserve long search result descriptions`,
  }))
  return {
    desktop: {
      responses: {
        tasks_active: (payload: unknown) => ({
          tasks: tasks.filter(task => task.projectId === (payload as { projectId: string }).projectId), related: [],
        }),
        get_latest_sessions: [],
        fs_search_files: (payload: unknown) => {
          const { query, limit } = payload as { query: string; limit: number }
          const files = state === 'empty' ? [] : state === 'overflow'
            ? Array.from({ length: 55 }, (_, i) => `src/deep/nested/directory/component-${String(i).padStart(2, '0')}.ts`)
            : ['src/navigation.ts', 'src/search.ts', 'src/', 'README.md']
          return files.filter(path => path.toLowerCase().includes(query.trim().toLowerCase())).slice(0, limit)
        },
      },
      // Hold the final read so teardown cannot trigger a second IPC call after the bridge is removed.
      deferred: state === 'loading' ? [workflow === 'files' ? 'fs_search_files' : 'get_latest_sessions'] : [],
      failures: state === 'failure' ? workflow === 'files'
        ? { fs_search_files: 'Catalog file search unavailable' }
        : { tasks_active: 'Catalog task search unavailable' } : {},
    },
    adapters: () => [
      ...(board.adapters?.() ?? []),
      seed(stores.projects, projects),
      seed(stores.projectAttention, new Map(state === 'attention' ? projects.map((project, index) => [project.id, {
        project_id: project.id, needs_input: index === 0 ? 2 : 0, running_agents: index === 1 ? 1 : 0,
        completed_agents: index === 2 ? 1 : 0, ci_failures: index === 3 ? 1 : 0, unaddressed_comments: index === 4 ? 3 : 0,
      }]) : [])),
      seed(stores.selectedTaskId, null),
      seed(stores.pendingTask, null),
      seed(stores.selectedReviewPr, null),
      seed(stores.projectViewSnapshots, new Map()),
      seed(stores.activeProjectId, state === 'unavailable' && workflow === 'files' ? null : 'project-1'),
      seed(installedPlugins, new Map()),
      seed(enabledPluginIds, new Set(['empty', 'failure'].includes(state) ? [] : ['story.navigation'])),
      seed(runtimeContributionSources, new Map()),
      createStoryCommandAdapter(FILE_VIEWER_PLUGIN_ID, [{
        id: 'revealFile', title: 'Reveal file', discoverable: false,
        handler: (payload) => setConfig('catalog.lastCommand', JSON.stringify({ id: 'revealFile', payload })),
      }]),
      createStoryCommandAdapter('story.navigation', [{
        id: 'refresh-index', title: 'Refresh catalog index',
        handler: () => setConfig('catalog.lastCommand', JSON.stringify({ id: 'refresh-index' })),
      }]),
      { install: resetHistory, reset: resetHistory, dispose: resetHistory },
    ],
  }
}

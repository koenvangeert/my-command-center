import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import { boardScenario } from './boardScenario'
import { createProject, createTask } from './appFixtures'

export type CreationWorkflowKind = 'task' | 'project'
export const creationPrompt = 'Review keyboard navigation and add regression tests for cancellation.'
export const longCreationPrompt = '## Goal\n\n' + 'Keep contributor workflows accessible at narrow widths. Preserve long repository names and acceptance criteria.\n\n'.repeat(20)

export function creationScenario(workflow: CreationWorkflowKind, state = 'default'): StoryScenarioDefinition {
  const board = boardScenario()
  const failureCommand = state === 'defaults-failure' ? 'resolve_ai_provider'
    : state === 'failure' ? workflow === 'task' ? 'create_task' : 'create_project_from_new_repo' : null
  const failure = state === 'defaults-failure' ? 'Catalog defaults unavailable'
    : workflow === 'task' ? 'Catalog task creation unavailable' : 'Catalog repository creation unavailable'
  const task = createTask({ id: 'T-99', status: 'backlog', prompt: creationPrompt })
  const project = createProject({ name: 'catalog-project', path: '/workspace/catalog-project' })
  return {
    desktop: {
      config: { use_worktrees: 'true', task_display_title_metadata_updates_enabled: 'true', default_repositories_dir: '/workspace' },
      projectConfig: { 'project-1': { use_worktrees: state === 'project-directory' ? 'false' : 'true' } },
      failureMode: 'message',
      deferred: state === 'loading' ? ['resolve_ai_provider']
        : state === 'saving' ? [workflow === 'task' ? 'create_task' : 'create_project_from_new_repo'] : [],
      failures: failureCommand ? { [failureCommand]: failure } : {},
      responses: {
        resolve_ai_provider: 'codex',
        repo_has_commits: state !== 'no-commits',
        list_git_branches: state === 'no-branches' ? [] : [
          { name: 'main', is_current: true, is_remote: false },
          { name: 'feature/keyboard-navigation', is_current: false, is_remote: false },
          { name: 'origin/feature/keyboard-navigation', is_current: false, is_remote: true },
        ],
        create_task: task,
        update_task: null,
        select_directory: state === 'picker-cancel' ? null : '/workspace/catalog-project',
        create_project: project,
        create_project_from_new_repo: project,
        create_project_from_git: project,
        list_opencode_commands: [{ name: 'review', description: 'Review changes and describe remaining risks', template: 'Review changes' }],
        list_opencode_agents: [],
        search_opencode_files: ['src/navigation.ts', 'src/keyboard.ts'],
      },
    },
    expectedConsoleErrors: failureCommand ? [
      `${state === 'defaults-failure' ? 'Failed to load task defaults:' : workflow === 'task' ? 'Failed to save task:' : 'Failed to create project:'} ${failure}`,
    ] : [],
    adapters: board.adapters,
  }
}

import * as stores from '../../../src/lib/stores'
import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import { createStoryStoreAdapter as seed } from '../environment/storyStoreAdapter'
import { createProject } from './appFixtures'

export type ChromeFeedback = 'none' | 'error' | 'checkpoint' | 'pipeline' | 'success' | 'rate-limit'

export function chromeScenario(feedback: ChromeFeedback = 'none'): StoryScenarioDefinition {
  return {
    adapters: () => [
      seed(stores.projects, [
        createProject({ id: 'P-1', name: 'OpenForge' }),
        createProject({ id: 'P-2', name: 'Documentation and contributor onboarding' }),
        createProject({ id: 'P-3', name: 'Archived experiments' }),
      ]),
      seed(stores.activeProjectId, 'P-1'),
      seed(stores.hiddenProjectIds, new Set(['P-3'])),
      seed(stores.currentView, 'board'),
      seed(stores.selectedTaskId, null),
      seed(stores.commandHeld, false),
      seed(stores.projectViewSnapshots, new Map()),
      seed(stores.focusBoardFilters, new Map()),
      seed(stores.outOfFocusTaskIdsByProject, new Map()),
      seed(stores.mergingTaskIds, new Set()),
      seed(stores.backlogLabelFilters, new Map()),
      seed(stores.backlogReadyFilters, new Map()),
      seed(stores.taskAttentionRows, [{
        task_id: 'T-42', project_id: 'P-1', project_name: 'OpenForge', title: 'Review authentication',
        state: 'needs-input', reason: 'Approval needed', activity_at: 1767346200, has_unread_agent_output: true,
      }]),
      seed(stores.reviewPrs, []),
      seed(stores.projectResolvedRepos, new Map()),
      seed(stores.error, feedback === 'error' ? 'Could not save project settings. Your changes have not been saved.' : null),
      seed(stores.checkpointNotification, feedback === 'checkpoint' ? {
        ticketId: 'T-42', ticketKey: 'OF-42', sessionId: 'session-42', stage: 'implement', message: 'Approval needed', timestamp: 1767346200,
      } : null),
      seed(stores.ciFailureNotification, feedback === 'pipeline' ? {
        task_id: 'T-42', pr_id: 42, pr_title: 'Preserve keyboard focus when switching between long project names', ci_status: 'failure', timestamp: 1767346200,
      } : null),
      seed(stores.taskSpawned, feedback === 'success' ? { taskId: 'T-43', promptText: 'Review keyboard navigation and focus restoration' } : null),
      seed(stores.rateLimitNotification, feedback === 'rate-limit' ? { reset_at: 1767346320, timestamp: 1767346200 } : null),
    ],
  }
}

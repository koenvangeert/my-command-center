import type { Meta, StoryObj } from '@storybook/svelte-vite'
import TaskGitStatus from '../../../src/components/task-detail/TaskGitStatus.svelte'
import type { GitStatusSummary } from '../../../src/lib/types'
const meta = { title: 'Components/Task Workspace/Changes', component: TaskGitStatus, args: { taskId: 'T-42' } } satisfies Meta<typeof TaskGitStatus>
export default meta
type Story = StoryObj<typeof meta>
const clean: GitStatusSummary = { has_remote: true, remote_ahead: 0, remote_behind: 0, local_commits: 0, uncommitted_files: 0, insertions: 0, deletions: 0, untracked_files: 0, untracked_insertions: 0 }
function scenario(summary: GitStatusSummary, state?: 'loading' | 'failure'): Story {
  return { parameters: { openforge: { desktop: {
    responses: { get_task_git_status: summary }, deferred: state === 'loading' ? ['get_task_git_status'] : [],
    failures: state === 'failure' ? { get_task_git_status: 'The worktree is unavailable.' } : {},
  } } } }
}
export const Clean: Story = scenario(clean)
export const Changed: Story = scenario({ ...clean, local_commits: 3, uncommitted_files: 4, insertions: 132, deletions: 27, untracked_files: 2, untracked_insertions: 40, remote_ahead: 3, remote_behind: 1 })
export const NoRemote: Story = scenario({ ...clean, has_remote: false })
export const Loading: Story = scenario(clean, 'loading')
export const Failure: Story = scenario(clean, 'failure')

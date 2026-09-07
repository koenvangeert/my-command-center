import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { fn } from 'storybook/test'
import SelfReviewRepositoryPreview from '../../../src/components/task-detail/SelfReviewRepositoryPreview.svelte'
import { getTaskFileContents } from '../../../src/lib/ipc'
const markdown = '# Contributor guide\n\nReview the task output before sending feedback.\n\n## Verification\n\nRun the focused tests and inspect the changes.'
const meta = {
  title: 'Components/Self Review/Repository Preview', component: SelfReviewRepositoryPreview,
  args: { target: { repositoryPath: 'README.md', suffix: '' }, selectedCommitSha: null,
    fetchContent: async (path: string) => (await getTaskFileContents('T-42', path, null, 'modified', true, true)).newContent,
    onOpenRepositoryPath: fn(), onClose: fn(), onOpenInFiles: fn(async () => true) },
} satisfies Meta<typeof SelfReviewRepositoryPreview>
export default meta
type Story = StoryObj<typeof meta>
function scenario(content: string, state?: 'loading' | 'failure'): Story {
  return { parameters: { openforge: { desktop: {
    responses: { get_task_file_contents: { oldContent: '', newContent: content } },
    deferred: state === 'loading' ? ['get_task_file_contents'] : [],
    failures: state === 'failure' ? { get_task_file_contents: 'This file is unavailable in the selected revision.' } : {},
  } } } }
}
export const Markdown: Story = scenario(markdown)
export const Source: Story = { ...scenario('export function greet(name: string) {\n  return `Hello ${name.trim()}`\n}\n'), args: { target: { repositoryPath: 'src/greet.ts', suffix: '' } } }
export const Empty: Story = scenario('')
export const Loading: Story = scenario(markdown, 'loading')
export const Failure: Story = scenario('', 'failure')
export const LongContent: Story = scenario('# Contributor guide\n\n' + '## Verify the integration\n\nPreserve keyboard navigation and readable content in constrained task workspaces.\n\n'.repeat(24))

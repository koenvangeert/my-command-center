import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import MarkdownContent from '../../../src/components/shared/adapters/MarkdownContent.svelte'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Components/Host Controls/Markdown', component: MarkdownContent,
  args: { content: '# Contributor notes\n\nReview **project settings** before starting work.\n\n- Keep changes focused\n- Run the affected tests\n\n```sh\npnpm test\n```\n\n[Project website](https://example.com/openforge)', onOpenRepositoryPath: fn() },
  parameters: { openforge: { desktop: { responses: { open_url: null } } } },
} satisfies Meta<typeof MarkdownContent>
export default meta
type Story = StoryObj<typeof meta>
export const Formatted: Story = {}
export const LongContent: Story = { args: { content: '# Long contributor notes\n\n' + 'A detailed explanation of project configuration and contributor workflow. '.repeat(30) + '\n\n| Setting | Value |\n| --- | --- |\n| Repository | `/workspace/contributor-onboarding/openforge` |' } }
export const Empty: Story = { args: { content: '' } }
export const OpenExternalLink: Story = {
  play: async (context) => {
    await userEvent.click(within(context.canvasElement).getByRole('link', { name: 'Project website' }))
    await waitFor(() => expect(getStoryScenario(context).desktop.calls).toContainEqual({ command: 'open_url', payload: { url: 'https://example.com/openforge' } }))
  },
}

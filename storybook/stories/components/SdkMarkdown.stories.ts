import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import MarkdownContent from '@openforge-app/plugin-sdk/ui/MarkdownContent.svelte'

const meta = {
  title: 'SDK/Markdown', component: MarkdownContent,
  args: {
    content: '# Release guide\n\nReview the **local changes** before publishing.\n\n> Reports never leave this workspace.\n\n| File | Status |\n| --- | --- |\n| plugin.ts | Ready |\n\n- [x] Review source\n- [ ] Publish package\n\n```typescript\nexport const report = { status: "ready" }\n```\n\n[Source](src/plugin.ts#L12) and [SDK documentation](https://example.com/sdk).',
    onOpenUrl: fn(), onOpenRepositoryPath: fn(), markdownFilePath: 'README.md',
  },
} satisfies Meta<typeof MarkdownContent>
export default meta
type Story = StoryObj<typeof meta>
export const RichText: Story = {}
export const Empty: Story = { args: { content: '' } }
export const LongCode: Story = { args: { content: '# Long output\n\n```text\n' + 'workspace/plugin/reports/very-long-output-path/'.repeat(12) + '\n```' } }
export const Diagram: Story = { args: { content: '# Report workflow\n\n```mermaid\nflowchart LR\n  Read --> Review --> Publish\n```' } }
export const Links: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('link', { name: 'Source' }))
    await expect(args.onOpenRepositoryPath).toHaveBeenCalledWith({ repositoryPath: 'src/plugin.ts', suffix: '#L12' })
    const external = canvas.getByRole('link', { name: 'SDK documentation' })
    external.focus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onOpenUrl).toHaveBeenCalledWith('https://example.com/sdk')
  },
}

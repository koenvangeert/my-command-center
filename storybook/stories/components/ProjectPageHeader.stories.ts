import type { Meta, StoryObj } from '@storybook/svelte-vite'
import ProjectPageHeader from '../../../src/components/project/ProjectPageHeader.svelte'

const meta = {
  title: 'Components/Host Chrome/Project Header', component: ProjectPageHeader,
  args: { title: 'OpenForge', subtitle: 'Project tools and application feedback' },
} satisfies Meta<typeof ProjectPageHeader>
export default meta
export const Default: StoryObj<typeof meta> = {}
export const LongContent: StoryObj<typeof meta> = {
  args: { title: 'Documentation and contributor onboarding across all repositories', subtitle: 'Shared project settings for contributors working across repositories with long names, detailed descriptions, and narrow application windows.' },
  globals: { viewport: { value: 'narrow', isRotated: false } },
}

import type { Meta, StoryObj } from '@storybook/svelte-vite'
import SdkPage from '../../shared/fixtures/SdkPage.svelte'
import { createStorySectionAdapter } from '../../shared/environment/storySectionAdapter'

const meta = {
  title: 'SDK/View states', component: SdkPage, args: { framed: false },
  parameters: { openforge: { adapters: () => [createStorySectionAdapter()] } },
} satisfies Meta<typeof SdkPage>
export default meta
type Story = StoryObj<typeof meta>
export const Content: Story = {}
export const Empty: Story = { args: { scenario: 'empty' } }
export const Loading: Story = { args: { scenario: 'loading' } }
export const Error: Story = { args: { scenario: 'error' } }
export const Overflow: Story = { args: { scenario: 'overflow' } }
export const Collapsed: Story = {
  parameters: { openforge: { adapters: () => [createStorySectionAdapter(['plugin:catalog:report'])] } },
}

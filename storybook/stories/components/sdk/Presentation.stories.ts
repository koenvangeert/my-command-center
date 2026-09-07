import type { Meta, StoryObj } from '@storybook/svelte-vite'
import Presentation from './Presentation.svelte'
import { narrowViewport } from './narrowViewport'

const meta = {
  title: 'Components/Plugin SDK/Presentation', component: Presentation,
} satisfies Meta<typeof Presentation>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const NarrowOverflow: Story = { ...narrowViewport, args: { overflow: true } }

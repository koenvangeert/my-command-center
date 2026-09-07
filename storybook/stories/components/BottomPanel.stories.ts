import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fireEvent, within } from 'storybook/test'
import BottomPanelFixture from '../../shared/BottomPanelFixture.svelte'

const meta = { title: 'Components/Host Controls/Bottom Panel', component: BottomPanelFixture } satisfies Meta<typeof BottomPanelFixture>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const FillParent: Story = { args: { fillParent: true } }
export const ResizeAndReset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const panel = canvas.getByTestId('resizable-bottom-panel')
    const handle = canvas.getByTestId('resize-handle')
    const document = canvasElement.ownerDocument
    for (let repeat = 0; repeat < 2; repeat++) {
      await fireEvent.mouseDown(handle, { clientY: 300 })
      await fireEvent.mouseMove(document, { clientY: 200 })
      await fireEvent.mouseUp(document)
      await expect(panel).toHaveStyle({ height: '320px' })
      await expect(document.defaultView!.localStorage.getItem('resizable-panel:storybook-host-chrome')).toBe('320')
      await fireEvent.doubleClick(handle)
      await expect(panel).toHaveStyle({ height: '220px' })
      await expect(document.defaultView!.localStorage.getItem('resizable-panel:storybook-host-chrome')).toBeNull()
    }
  },
}

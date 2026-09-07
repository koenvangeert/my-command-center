import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import CompanionDevicesFrame from '../../shared/frames/CompanionDevicesFrame.svelte'
import type { CompanionPairedDevice } from '../../../src/lib/types'

const activeDevice: CompanionPairedDevice = {
  deviceId: 'catalog-device-1', deviceName: 'Work phone', platform: 'ios',
  pairedAt: '2026-01-01T09:00:00Z', lastSeenAt: '2026-01-02T09:00:00Z', revokedAt: null,
}
const revokedDevice: CompanionPairedDevice = {
  ...activeDevice, deviceId: 'catalog-device-2', deviceName: 'Retired test phone', platform: 'android',
  lastSeenAt: null, revokedAt: '2026-01-02T08:00:00Z',
}
const meta = {
  title: 'Components/Settings/Companion Devices', component: CompanionDevicesFrame,
  args: { devices: [activeDevice, revokedDevice], updating: false, onrevoke: fn(), onremove: fn() },
} satisfies Meta<typeof CompanionDevicesFrame>
export default meta
type Story = StoryObj<typeof meta>

export const PairedAndRevoked: Story = {}
export const Updating: Story = { args: { updating: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await expect(canvas.getByRole('button', { name: 'Revoke Work phone' })).toBeDisabled()
  await expect(canvas.getByRole('button', { name: 'Remove Retired test phone' })).toBeDisabled()
} }
export const LongNames: Story = {
  args: { devices: [{ ...activeDevice, deviceName: 'Accessibility lab phone with a long descriptive name for shared team use', deviceId: 'catalog-device-with-a-long-identifier-0123456789-0123456789' }] },
}
export const Actions: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Revoke Work phone' }))
  await expect(args.onrevoke).toHaveBeenCalledWith(activeDevice)
  await userEvent.click(canvas.getByRole('button', { name: 'Remove Retired test phone' }))
  await expect(args.onremove).toHaveBeenCalledWith(revokedDevice)
} }

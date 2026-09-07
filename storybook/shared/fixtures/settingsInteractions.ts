import { expect, userEvent, waitFor, within } from 'storybook/test'

export async function settingsReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await waitFor(() => expect(canvas.queryByText('Loading settings…')).not.toBeInTheDocument())
  return canvas
}

export async function openSettingsSection(canvasElement: HTMLElement, category: string, heading: string) {
  const canvas = await settingsReady(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: new RegExp(`^${category}:`) }))
  await expect(canvas.findByRole('heading', { name: heading })).resolves.toBeVisible()
  return canvas
}

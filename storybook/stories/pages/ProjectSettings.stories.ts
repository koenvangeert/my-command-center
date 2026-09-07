import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SettingsPage from '../../shared/frames/SettingsPage.svelte'
import { settingsScenario } from '../../shared/fixtures/settingsScenario'
import { openSettingsSection, settingsReady } from '../../shared/fixtures/settingsInteractions'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = {
  title: 'Pages/Project Settings', component: SettingsPage,
  parameters: { openforge: settingsScenario('project') },
  args: { mode: 'project', onClose: fn(), onProjectDeleted: fn() },
} satisfies Meta<typeof SettingsPage>
export default meta
type Story = StoryObj<typeof meta>

export const General: Story = { play: async ({ canvasElement }) => { await settingsReady(canvasElement) } }
export const Agents: Story = { play: async ({ canvasElement }) => { await openSettingsSection(canvasElement, 'Agents & tasks', 'Project configuration') } }
export const Labels: Story = { play: async ({ canvasElement }) => {
  const canvas = await openSettingsSection(canvasElement, 'Labels', 'Task Labels')
  await expect(canvas.findByText('accessibility', { exact: true })).resolves.toBeVisible()
} }
export const FocusFilter: Story = { play: async ({ canvasElement }) => { await openSettingsSection(canvasElement, 'Focus filter', 'Focus Filter States') } }
export const Instructions: Story = { play: async ({ canvasElement }) => { await openSettingsSection(canvasElement, 'AI instructions', 'AI Instructions') } }
export const Plugins: Story = { play: async ({ canvasElement }) => { await openSettingsSection(canvasElement, 'Plugins', 'Project dashboard') } }
export const DangerZone: Story = { play: async ({ canvasElement }) => {
  const canvas = await openSettingsSection(canvasElement, 'Danger Zone', 'Danger Zone')
  await userEvent.click(canvas.getByRole('button', { name: 'Delete Project' }))
  await expect(canvas.getByRole('button', { name: 'Yes, delete' })).toBeVisible()
} }
export const Edited: Story = { play: async (context) => {
  const canvas = await settingsReady(context.canvasElement)
  const input = canvas.getByRole('textbox', { name: 'Run Command' })
  await userEvent.clear(input)
  await userEvent.type(input, 'pnpm preview')
  await expect(canvas.findByText('All changes saved')).resolves.toBeVisible()
  await expect(getStoryScenario(context).desktop.bridge.invoke('get_project_config', { projectId: 'project-1', key: 'run_command' })).resolves.toBe('pnpm preview')
  // Capture the persisted resting state, not the short-lived saved confirmation.
  await expect(canvas.findByText('Autosaves changes', {}, { timeout: 5000 })).resolves.toBeVisible()
} }
export const Loading: Story = {
  parameters: { openforge: settingsScenario('project', 'loading') },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).findByText('Loading settings…')).resolves.toBeVisible() },
}
export const Failure: Story = {
  parameters: { openforge: settingsScenario('project', 'failure') },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).findByText(/Failed to load settings: Settings unavailable/)).resolves.toBeVisible() },
}
export const SaveFailure: Story = {
  parameters: { openforge: settingsScenario('project', 'save-failure') },
  play: async ({ canvasElement }) => {
    const canvas = await settingsReady(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Project Name' }), ' edited')
    await expect(canvas.findByText(/Autosave failed: Settings are read-only/)).resolves.toBeVisible()
  },
}
export const InheritedDefaults: Story = {
  parameters: { openforge: settingsScenario('project', 'overrides') },
  play: async (context) => {
    const canvas = await openSettingsSection(context.canvasElement, 'Agents & tasks', 'Project configuration')
    await userEvent.click(canvas.getByRole('button', { name: 'Reset AI Provider to global default' }))
    await expect(getStoryScenario(context).desktop.bridge.invoke('get_project_config', { projectId: 'project-1', key: 'ai_provider' })).resolves.toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Reset AI Provider to global default' })).not.toBeInTheDocument()
  },
}
export const LabelValidation: Story = { play: async ({ canvasElement }) => {
  const canvas = await openSettingsSection(canvasElement, 'Labels', 'Task Labels')
  await expect(canvas.findByText('accessibility', { exact: true })).resolves.toBeVisible()
  await userEvent.type(canvas.getByPlaceholderText('New label name'), 'accessibility')
  await userEvent.click(canvas.getByRole('button', { name: 'Add Label' }))
  await expect(canvas.findByText('Label already exists')).resolves.toBeVisible()
} }
export const Saving: Story = {
  parameters: { openforge: settingsScenario('project', 'saving') },
  play: async ({ canvasElement }) => {
    const canvas = await settingsReady(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Project Name' }), ' edited')
    await expect(canvas.findByText('Saving changes…')).resolves.toBeVisible()
  },
}
export const ProviderMissing: Story = { parameters: { openforge: settingsScenario('project', 'provider-missing') }, play: Agents.play }
export const Disabled: Story = { parameters: { openforge: settingsScenario('project', 'disabled') } }
export const Narrow: Story = { globals: { viewport: { value: 'narrow', isRotated: false } } }
export const LongContent: Story = { parameters: { openforge: settingsScenario('project', 'long') }, play: Instructions.play }

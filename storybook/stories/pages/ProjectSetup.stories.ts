import type { Meta, StoryObj } from '@storybook/svelte-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ProjectSetupDialog from '../../../src/components/project/ProjectSetupDialog.svelte'
import { createProject } from '../../shared/fixtures/appFixtures'

const meta = {
  title: 'Pages/Project Setup',
  component: ProjectSetupDialog,
  args: { onClose: fn(), onProjectCreated: fn() },
  parameters: { openforge: { desktop: { config: { default_repositories_dir: '/workspace' } } } },
} satisfies Meta<typeof ProjectSetupDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const Failure: Story = {
  parameters: { openforge: { desktop: {
    config: { default_repositories_dir: '/workspace' },
    failures: { create_project_from_new_repo: 'Story fixture: repository creation unavailable' },
  } } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('radio', { name: /New repo/ }))
    await userEvent.type(body.getByRole('textbox', { name: 'Project Name' }), 'migration-baseline')
    await userEvent.click(body.getByRole('button', { name: 'Create Project', exact: true }))
    await expect(body.findByRole('alert')).resolves.toHaveTextContent('Story fixture: repository creation unavailable')
  },
}
export const Success: Story = {
  parameters: { openforge: { desktop: {
    config: { default_repositories_dir: '/workspace' },
    responses: { create_project_from_new_repo: createProject({ name: 'migration-baseline' }) },
  } } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('radio', { name: /New repo/ }))
    await userEvent.type(body.getByRole('textbox', { name: 'Project Name' }), 'migration-baseline')
    await userEvent.click(body.getByRole('button', { name: 'Create Project', exact: true }))
    await expect(body.findByRole('status')).resolves.toHaveTextContent('Project created. Opening migration-baseline.')
    await expect(body.findByRole('button', { name: 'Create Project', exact: true })).resolves.toBeEnabled()
  },
}

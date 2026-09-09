import { expect, userEvent, waitFor } from 'storybook/test'
import { creationMeta, creationState, creationQueries as queries, creationReady, reopenCreation, type CreationContext, type CreationStory } from '../../shared/creationStories'
import { getStoryScenario } from '../../shared/storyEnvironmentPreview'

const meta = { ...creationMeta('project', 'Pages/Project Setup'), title: 'Pages/Project Setup' }
export default meta
async function newRepository(context: CreationContext) {
  await userEvent.click(await queries(context).findByRole('radio', { name: /New repo/ }))
  await userEvent.type(queries(context).getByRole('textbox', { name: 'Project Name' }), 'catalog-project')
  await waitFor(() => expect(queries(context).getByRole('button', { name: 'Create Project' })).toBeEnabled())
}
export const Empty: CreationStory = {}
export const NewRepository: CreationStory = {
  play: async (context) => { await newRepository(context); creationReady(context) },
}
export const CloneRepository: CreationStory = {
  play: async (context) => {
    await userEvent.click(queries(context).getByRole('radio', { name: /From GitHub/ }))
    await userEvent.type(queries(context).getByRole('textbox', { name: 'Repository URL' }), 'https://github.com/example/catalog-project')
    await expect(queries(context).getByRole('textbox', { name: 'Project Name' })).toHaveValue('catalog-project')
    await expect(queries(context).getByText('/workspace/catalog-project')).toBeInTheDocument()
    creationReady(context)
  },
}
export const LocalRepository: CreationStory = {
  play: async (context) => {
    await userEvent.click(queries(context).getByRole('button', { name: 'Select Repository' }))
    await expect(queries(context).findByRole('textbox', { name: 'Project Name' })).resolves.toHaveValue('catalog-project')
    creationReady(context)
  },
}
export const Validation: CreationStory = {
  play: async (context) => {
    await newRepository(context)
    await userEvent.clear(queries(context).getByRole('textbox', { name: 'Project Name' }))
    await userEvent.type(queries(context).getByRole('textbox', { name: 'Project Name' }), '   ')
    await expect(queries(context).getByRole('button', { name: 'Create Project' })).toBeDisabled()
    creationReady(context)
  },
}
export const Failure: CreationStory = {
  ...creationState('project', 'failure'),
  play: async (context) => {
    await newRepository(context)
    await userEvent.click(queries(context).getByRole('button', { name: 'Create Project' }))
    await expect(queries(context).findByRole('alert')).resolves.toHaveTextContent('Catalog repository creation unavailable')
    await expect(context.args.onProjectCreated).not.toHaveBeenCalled()
    creationReady(context)
  },
}
export const Loading: CreationStory = {
  ...creationState('project', 'saving'),
  play: async (context) => {
    await newRepository(context)
    await userEvent.click(queries(context).getByRole('button', { name: 'Create Project' }))
    await expect(queries(context).findByRole('button', { name: 'Creating repo...' })).resolves.toBeDisabled()
    await expect(queries(context).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    creationReady(context)
  },
}
export const Success: CreationStory = {
  play: async (context) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await newRepository(context)
      await userEvent.click(queries(context).getByRole('button', { name: 'Create Project' }))
      await waitFor(() => expect(context.args.onProjectCreated).toHaveBeenCalledTimes(attempt + 1))
      await expect(getStoryScenario(context).desktop.calls).toContainEqual({ command: 'create_project_from_new_repo', payload: { name: 'catalog-project', parentDir: '/workspace', private: true } })
      await reopenCreation(context)
    }
    creationReady(context)
  },
}
export const CloneCompletion: CreationStory = {
  play: async (context) => {
    await userEvent.click(queries(context).getByRole('radio', { name: /From GitHub/ }))
    await userEvent.type(queries(context).getByRole('textbox', { name: 'Repository URL' }), 'example/catalog-project')
    await userEvent.click(queries(context).getByRole('button', { name: 'Create Project' }))
    await waitFor(() => expect(context.args.onProjectCreated).toHaveBeenCalledTimes(1))
    await expect(getStoryScenario(context).desktop.calls).toContainEqual({ command: 'create_project_from_git', payload: { url: 'example/catalog-project', parentDir: '/workspace', name: 'catalog-project' } })
    await reopenCreation(context)
    creationReady(context)
  },
}
export const PickerCancellation: CreationStory = {
  ...creationState('project', 'picker-cancel'),
  play: async (context) => {
    await userEvent.click(queries(context).getByRole('button', { name: 'Select Repository' }))
    await expect(queries(context).getByRole('button', { name: 'Create Project' })).toBeDisabled()
    await expect(context.args.onProjectCreated).not.toHaveBeenCalled()
    creationReady(context)
  },
}
export const CancelAndReopen: CreationStory = {
  play: async (context) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await newRepository(context)
      await userEvent.click(queries(context).getByRole('button', { name: 'Cancel' }))
      await reopenCreation(context)
      await userEvent.click(queries(context).getByRole('radio', { name: /New repo/ }))
      await expect(queries(context).getByRole('textbox', { name: 'Project Name' })).toHaveValue('')
    }
    creationReady(context)
  },
}
export const LongContent: CreationStory = {
  play: async (context) => {
    await newRepository(context)
    const input = queries(context).getByRole('textbox', { name: 'Project Name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'catalog-project-with-a-long-repository-name-for-contributor-setup')
    creationReady(context)
  },
}
export const Narrow: CreationStory = { ...NewRepository, globals: { viewport: { value: 'narrow', isRotated: false } } }

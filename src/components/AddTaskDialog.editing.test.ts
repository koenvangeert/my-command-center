import { mockTask, findPromptTextbox, resetDialogMocks } from './AddTaskDialog.testFixtures'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AddTaskDialog from './AddTaskDialog.svelte'
import { updateTaskInitialPrompt } from '../lib/ipc'

describe('AddTaskDialog editing', () => {
  beforeEach(resetDialogMocks)

  it('pre-fills fields in edit mode', async () => {
    render(AddTaskDialog, { props: { mode: 'edit', task: mockTask } })
    expect(screen.getByRole('heading', { name: 'Edit task' })).toBeTruthy()
    
    const textbox = await findPromptTextbox()
    expect(textbox.value).toBe('Existing Task')
  })

  it('pre-fills edit mode from mutable prompt when present', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: { ...mockTask, prompt: 'Mutable prompt text' },
      },
    })

    const textbox = await findPromptTextbox()
    expect(textbox.value).toBe('Mutable prompt text')
  })

  it('hides persisted image reference definitions when editing a task prompt', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
      },
    })

    const textbox = await findPromptTextbox()
    expect(textbox.value).toBe('Inspect [image#1] carefully')
    expect(textbox.value).not.toContain('data:image/png;base64')
  })

  it('shows persisted image marker controls when editing a task prompt', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
      },
    })

    await findPromptTextbox()

    expect(screen.getByText('1 image ready')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Preview [image#1]' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Attach image' })).toBeTruthy()
  })

  it('pastes an additional image marker while editing a persisted image prompt', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
      },
    })

    const textbox = await findPromptTextbox()
    textbox.setSelectionRange(textbox.value.length, textbox.value.length)
    await fireEvent.paste(textbox, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/jpeg',
            getAsFile: () => new File(['second-image'], 'second.jpg', { type: 'image/jpeg' }),
          },
        ],
      },
    })

    await waitFor(() => {
      expect(textbox.value).toBe('Inspect [image#1] carefully [image#2] ')
      expect(screen.getByText('2 images ready')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Preview [image#1]' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Preview [image#2]' })).toBeTruthy()
    })

    await fireEvent.click(await screen.findByRole('button', { name: /Submit/ }))

    await waitFor(() => {
      const prompt = vi.mocked(updateTaskInitialPrompt).mock.calls[0][1]
      expect(updateTaskInitialPrompt).toHaveBeenCalledWith('T-42', prompt)
      expect(prompt).toContain('Inspect [image#1] carefully [image#2]')
      expect(prompt).toContain('[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=')
      expect(prompt).toContain('[image#2]: data:image/jpeg;base64,')
    })
  })

  it('opens a persisted image preview when an inline marker is clicked in edit mode', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
      },
    })

    const textbox = await findPromptTextbox()
    const markerStart = textbox.value.indexOf('[image#1]')
    textbox.setSelectionRange(markerStart + 2, markerStart + 2)
    await fireEvent.click(textbox)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Pasted image [image#1]' })).toBeTruthy()
      expect(screen.getByRole('img', { name: 'Pasted image [image#1]' })).toBeTruthy()
    })
  })

  it('updates the initial prompt when submitted in edit mode', async () => {
    const onTaskSaved = vi.fn()
    render(AddTaskDialog, { props: { mode: 'edit', task: mockTask, onTaskSaved } })
    
    const submitBtn = await screen.findByRole('button', { name: /Submit/ })
    await fireEvent.click(submitBtn)
    
    await waitFor(() => {
      expect(updateTaskInitialPrompt).toHaveBeenCalledWith('T-42', 'Existing Task')
      expect(onTaskSaved).toHaveBeenCalled()
    })
  })

  it('preserves persisted image references when saving an edited prompt that keeps the marker', async () => {
    const onTaskSaved = vi.fn()
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
        onTaskSaved,
      },
    })

    const textbox = await findPromptTextbox()
    await fireEvent.input(textbox, { target: { value: 'Inspect [image#1] again' } })
    await fireEvent.click(await screen.findByRole('button', { name: /Submit/ }))

    await waitFor(() => {
      expect(updateTaskInitialPrompt).toHaveBeenCalledWith(
        'T-42',
        'Inspect [image#1] again\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
      )
      expect(onTaskSaved).toHaveBeenCalled()
    })
  })

  it('drops persisted image references when saving an edited prompt after deleting the marker', async () => {
    render(AddTaskDialog, {
      props: {
        mode: 'edit',
        task: {
          ...mockTask,
          prompt: 'Inspect [image#1] carefully\n\n[image#1]: data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        },
      },
    })

    const textbox = await findPromptTextbox()
    await fireEvent.input(textbox, { target: { value: 'Inspect carefully' } })
    await fireEvent.click(await screen.findByRole('button', { name: /Submit/ }))

    await waitFor(() => {
      expect(updateTaskInitialPrompt).toHaveBeenCalledWith('T-42', 'Inspect carefully')
    })
  })
})

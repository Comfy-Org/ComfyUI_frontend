import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import EditableText from './EditableText.vue'

describe('EditableText', () => {
  function renderComponent(
    props: { modelValue: string; isEditing?: boolean },
    callbacks: {
      onEdit?: (...args: unknown[]) => void
      onCancel?: (...args: unknown[]) => void
    } = {}
  ) {
    const user = userEvent.setup()

    render(EditableText, {
      props: {
        ...props,
        ...(callbacks.onEdit && { onEdit: callbacks.onEdit }),
        ...(callbacks.onCancel && { onCancel: callbacks.onCancel })
      }
    })

    return { user }
  }

  it('renders span with modelValue when not editing', () => {
    renderComponent({ modelValue: 'Test Text', isEditing: false })
    expect(screen.getByText('Test Text')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders input with modelValue when editing', () => {
    renderComponent({ modelValue: 'Test Text', isEditing: true })
    expect(screen.queryByText('Test Text')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Test Text')
  })

  it('emits edit event when input is submitted', async () => {
    const onEdit = vi.fn()
    const { user } = renderComponent(
      { modelValue: 'Test Text', isEditing: true },
      { onEdit }
    )

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Text')
    await user.keyboard('{Enter}')

    expect(onEdit).toHaveBeenCalledWith('New Text')
  })

  it('finishes editing on blur', async () => {
    const onEdit = vi.fn()
    renderComponent({ modelValue: 'Test Text', isEditing: true }, { onEdit })

    await fireEvent.blur(screen.getByRole('textbox'))

    expect(onEdit).toHaveBeenCalledWith('Test Text')
  })

  it('cancels editing on escape key', async () => {
    const onEdit = vi.fn()
    const onCancel = vi.fn()
    const { user } = renderComponent(
      { modelValue: 'Original Text', isEditing: true },
      { onEdit, onCancel }
    )

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Modified Text')
    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
    expect(input).toHaveValue('Original Text')
  })

  it('does not save changes when escape is pressed', async () => {
    const onEdit = vi.fn()
    const onCancel = vi.fn()
    const { user } = renderComponent(
      { modelValue: 'Original Text', isEditing: true },
      { onEdit, onCancel }
    )

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Modified Text')
    // Escape triggers cancelEditing → blur internally, so no separate blur needed
    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('saves changes on enter but not on escape', async () => {
    const onEditEnter = vi.fn()
    const { user: userEnter } = renderComponent(
      { modelValue: 'Original Text', isEditing: true },
      { onEdit: onEditEnter }
    )

    const enterInput = screen.getByRole('textbox')
    await userEnter.clear(enterInput)
    await userEnter.type(enterInput, 'Saved Text')
    await userEnter.keyboard('{Enter}')

    expect(onEditEnter).toHaveBeenCalledWith('Saved Text')
  })
})

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Textarea from './Textarea.vue'

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(Textarea)

    expect(screen.getByRole('textbox')).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('populates the textarea with the initial v-model value', () => {
    render(Textarea, { props: { modelValue: 'initial text' } })

    expect(screen.getByRole('textbox')).toHaveValue('initial text')
  })

  it('emits update:modelValue as the user types', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn<(value: string | number | undefined) => void>()

    render(Textarea, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': onUpdate
      }
    })

    await user.type(screen.getByRole('textbox'), 'hi')

    expect(onUpdate).toHaveBeenCalled()
    expect(onUpdate.mock.calls.at(-1)?.[0]).toBe('hi')
  })

  it('forwards placeholder and rows attrs to the native textarea', () => {
    render(Textarea, {
      attrs: { placeholder: 'Write something', rows: 6 }
    })

    const textarea = screen.getByPlaceholderText('Write something')
    expect(textarea).toHaveAttribute('rows', '6')
  })

  it('does not accept typed input when disabled', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(Textarea, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': onUpdate
      },
      attrs: { disabled: true }
    })

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
    await user.type(textarea, 'blocked')

    expect(onUpdate).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('')
  })

  it('forwards custom class alongside internal classes', () => {
    render(Textarea, { props: { class: 'custom-extra-class' } })

    expect(screen.getByRole('textbox')).toHaveClass('custom-extra-class')
  })
})

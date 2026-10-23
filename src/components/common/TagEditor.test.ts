import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TagEditor from '@/components/common/TagEditor.vue'

function renderEditor(props: InstanceType<typeof TagEditor>['$props'] = {}) {
  return render(TagEditor, {
    props,
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { g: { removeTag: 'Remove tag' } } }
        })
      ]
    }
  })
}

describe('TagEditor', () => {
  it('activates editing and removes a tag with a translated control', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    renderEditor({
      modelValue: ['alpha', 'beta'],
      'onUpdate:modelValue': update
    })

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByText('alpha'))
    expect(screen.getByRole('textbox')).toHaveFocus()
    await user.click(screen.getAllByRole('button', { name: 'Remove tag' })[0])

    expect(update).toHaveBeenLastCalledWith(['beta'])
  })

  it('adds a typed tag through the default input', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    renderEditor({
      modelValue: [],
      alwaysEditing: true,
      placeholder: 'Add tag',
      'onUpdate:modelValue': update
    })

    await user.type(screen.getByPlaceholderText('Add tag'), 'gamma{Enter}')

    expect(update).toHaveBeenLastCalledWith(['gamma'])
  })

  it('keeps immutable tags non-editable', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    renderEditor({
      modelValue: ['alpha'],
      disabled: true,
      'onUpdate:modelValue': update
    })

    await user.click(screen.getByText('alpha'))
    await user.click(screen.getByRole('button', { name: 'Remove tag' }))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})

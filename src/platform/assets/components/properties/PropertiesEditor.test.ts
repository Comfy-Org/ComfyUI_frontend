import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { UserProperties } from '@/platform/assets/schemas/userPropertySchema'

import PropertiesEditor from './PropertiesEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('PropertiesEditor callback delegation', () => {
  it('calls handlePropertyUpdate for string edits', async () => {
    const handleUpdate = vi.fn()
    const properties: UserProperties = {
      caption: { type: 'string', value: 'old', _order: 0 }
    }

    const { container } = render(PropertiesEditor, {
      props: {
        modelValue: properties,
        handlePropertyUpdate: handleUpdate
      }
    })

    const textarea = within(container as HTMLElement).getByRole('textbox', {
      name: (_, el) => (el as HTMLElement).tagName === 'TEXTAREA'
    })
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'new value')

    expect(handleUpdate).toHaveBeenCalledWith('caption', {
      type: 'string',
      value: 'new value'
    })
  })

  it('calls handlePropertyDelete when delete button is clicked', async () => {
    const handleDelete = vi.fn()
    const properties: UserProperties = {
      caption: { type: 'string', value: 'hello', _order: 0 }
    }

    render(PropertiesEditor, {
      props: {
        modelValue: properties,
        handlePropertyDelete: handleDelete
      }
    })

    const deleteButton = screen.getByRole('button', { name: 'g.delete' })
    await userEvent.click(deleteButton)

    expect(handleDelete).toHaveBeenCalledWith('caption')
  })
})

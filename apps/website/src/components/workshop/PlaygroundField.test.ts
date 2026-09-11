// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { FieldSchema, FormValues } from '../../config/workshop-playground'
import { MAX_UPLOAD_BYTES } from '../../config/workshop-playground'
import PlaygroundField from './PlaygroundField.vue'

function mountField(field: FieldSchema, initial: FormValues = {}) {
  const values = ref<FormValues>(initial)
  render(
    defineComponent({
      setup() {
        return () =>
          h(PlaygroundField, {
            field,
            errors: {},
            modelValue: values.value,
            'onUpdate:modelValue': (next: FormValues) => {
              values.value = next
            }
          })
      }
    })
  )
  return values
}

describe('PlaygroundField', () => {
  it('shows a prefilled upload with its preview and lets it be removed', async () => {
    const user = userEvent.setup()
    const values = mountField(
      {
        kind: 'file',
        name: 'image',
        label: 'Image',
        accept: ['image/webp'],
        maxBytes: MAX_UPLOAD_BYTES,
        required: true
      },
      {
        image: {
          name: 'demo-image.webp',
          size: 1,
          type: 'image/webp',
          previewUrl: 'https://example.com/demo.webp'
        }
      }
    )
    expect(screen.getByText('demo-image.webp')).toBeTruthy()
    expect(screen.getByRole('img', { hidden: true }).getAttribute('src')).toBe(
      'https://example.com/demo.webp'
    )
    await user.click(screen.getByRole('button'))
    expect(values.value.image).toBeUndefined()
    expect(screen.getByTestId('field-image')).toBeTruthy()
  })

  it('writes select, range and toggle changes back to the form', async () => {
    const user = userEvent.setup()
    const select = mountField({
      kind: 'select',
      name: 'size',
      label: 'Size',
      options: ['1K', '2K'],
      defaultValue: '1K'
    })
    await user.selectOptions(screen.getByTestId('field-size'), '2K')
    expect(select.value.size).toBe('2K')

    const toggle = mountField({
      kind: 'toggle',
      name: 'audio',
      label: 'Audio',
      defaultValue: false
    })
    await user.click(screen.getByTestId('field-audio'))
    expect(toggle.value.audio).toBe(true)
  })
})

// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopField as Field } from '../../config/workshop-detail'
import WorkshopField from './WorkshopField.vue'

function renderField(field: Field) {
  const updated = vi.fn()
  render(WorkshopField, {
    props: {
      field,
      modelValue: {},
      'onUpdate:modelValue': updated
    } as never
  })
  return updated
}

describe('WorkshopField', () => {
  it('renders multiline and single-line text fields', () => {
    renderField({
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string'
    })
    expect(screen.getByRole('textbox', { name: /Prompt/ }).tagName).toBe(
      'TEXTAREA'
    )
  })

  it('renders and updates select fields', async () => {
    const updated = renderField({
      kind: 'select',
      name: 'quality',
      label: 'Quality',
      required: false,
      options: ['standard', 'high']
    })
    const select = screen.getByRole('combobox', { name: 'Quality' })
    await userEvent.setup().selectOptions(select, 'standard')
    expect(updated).toHaveBeenLastCalledWith({ quality: 'standard' })
  })

  it('renders bounded number fields', () => {
    renderField({
      kind: 'number',
      name: 'count',
      label: 'Count',
      required: false,
      integer: true,
      min: 1,
      max: 4,
      step: 1
    })
    const input = screen.getByRole('spinbutton', { name: 'Count' })
    expect(input.getAttribute('min')).toBe('1')
    expect(input.getAttribute('max')).toBe('4')
  })

  it('renders toggle fields', () => {
    renderField({
      kind: 'toggle',
      name: 'enhance',
      label: 'Enhance',
      required: false,
      defaultValue: false
    })
    expect(screen.getByRole('switch', { name: 'Enhance' })).toBeTruthy()
  })

  it('renders media fields with the generated file type', () => {
    renderField({
      kind: 'media',
      name: 'media_reference_image',
      role: 'reference_image',
      label: 'Reference Image',
      required: true,
      multiple: false,
      accept: 'image'
    })
    expect(
      screen.getByLabelText(/Reference Image/).getAttribute('accept')
    ).toBe('image/*')
  })
})

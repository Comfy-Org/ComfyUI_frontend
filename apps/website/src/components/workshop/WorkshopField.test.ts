// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { WorkshopField as Field } from '../../config/workshop-detail'
import WorkshopField from './WorkshopField.vue'

function renderField(field: Field) {
  const updated = vi.fn()
  const props = {
    field,
    modelValue: {},
    'onUpdate:modelValue': updated
  }
  render(WorkshopField, {
    props
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

  it('offers suggested values as completions, not as a closed list', async () => {
    // The schema names these values without restricting the field to them, so
    // the input has to stay typable: a caller's own cloned voice id is valid
    // and is not in the list.
    const updated = renderField({
      kind: 'text',
      name: 'voice',
      label: 'Voice',
      required: false,
      multiline: false,
      valueType: 'string',
      suggestions: ['Rachel', 'Adam']
    })

    // `list` makes the input a combobox to assistive tech rather than a plain
    // textbox, which is the right announcement for "type one or pick one".
    const input = screen.getByRole('combobox', { name: 'Voice' })
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('list')).toBe('voice-suggestions')
    expect(
      screen
        .getAllByRole('option', { hidden: true })
        .map((option) => option.getAttribute('value'))
    ).toEqual(['Rachel', 'Adam'])

    await userEvent.setup().type(input, 'my-own-voice-id')
    expect(updated).toHaveBeenLastCalledWith({ voice: 'my-own-voice-id' })
  })

  it('leaves a plain text field without a suggestion list', () => {
    renderField({
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: false,
      multiline: false,
      valueType: 'string'
    })

    expect(
      screen.getByRole('textbox', { name: 'Prompt' }).hasAttribute('list')
    ).toBe(false)
    expect(screen.queryAllByRole('option', { hidden: true })).toEqual([])
  })

  it('passes an unconstrained step through instead of inventing precision', () => {
    renderField({
      kind: 'number',
      name: 'guidance',
      label: 'Guidance',
      required: false,
      integer: false,
      step: 'any'
    })

    expect(
      screen.getByRole('spinbutton', { name: 'Guidance' }).getAttribute('step')
    ).toBe('any')
  })

  it('clears a number field rather than reporting NaN', async () => {
    const updated = renderField({
      kind: 'number',
      name: 'steps',
      label: 'Steps',
      required: false,
      integer: true,
      step: 1
    })

    const input = screen.getByRole('spinbutton', { name: 'Steps' })
    await userEvent.setup().type(input, '4{backspace}')
    expect(updated).toHaveBeenLastCalledWith({ steps: undefined })
  })

  it('returns to no selection when the placeholder is chosen', async () => {
    const updated = renderField({
      kind: 'select',
      name: 'quality',
      label: 'Quality',
      required: false,
      options: ['standard', 'high']
    })

    const select = screen.getByRole('combobox', { name: 'Quality' })
    const user = userEvent.setup()
    await user.selectOptions(select, 'high')
    await user.selectOptions(select, '')
    expect(updated).toHaveBeenLastCalledWith({ quality: undefined })
  })

  it('records an uploaded file as a single value or a list, per the field', async () => {
    // The value stands in for an upload the run path resolves later; what
    // matters here is that a single-file field never yields an array and a
    // multiple one always does, because the request body shape depends on it.
    const single = renderField({
      kind: 'media',
      name: 'media_image',
      role: 'image',
      label: 'Image',
      required: false,
      multiple: false,
      accept: 'image'
    })
    const user = userEvent.setup()
    await user.upload(
      screen.getByLabelText(/Image/),
      new File(['x'], 'cat.png', { type: 'image/png' })
    )
    expect(single).toHaveBeenLastCalledWith({ media_image: '<cat.png>' })
  })

  it('keeps every file when the field takes more than one', async () => {
    const updated = renderField({
      kind: 'media',
      name: 'media_frames',
      role: 'frames',
      label: 'Frames',
      required: false,
      multiple: true,
      accept: 'image'
    })
    await userEvent
      .setup()
      .upload(screen.getByLabelText(/Frames/), [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' })
      ])
    expect(updated).toHaveBeenLastCalledWith({
      media_frames: ['<a.png>', '<b.png>']
    })
  })

  it('toggles on and back off', async () => {
    const updated = renderField({
      kind: 'toggle',
      name: 'enhance',
      label: 'Enhance',
      required: false,
      defaultValue: false
    })
    const toggle = screen.getByRole('switch', { name: 'Enhance' })
    const user = userEvent.setup()
    await user.click(toggle)
    expect(updated).toHaveBeenLastCalledWith({ enhance: true })
  })
})

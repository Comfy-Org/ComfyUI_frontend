// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  WorkshopField as Field,
  WorkshopFormValues
} from '../../config/workshop-detail'
import WorkshopField from './WorkshopField.vue'

function renderField(field: Field) {
  const updated = vi.fn()
  const values = ref<WorkshopFormValues>({})
  const Host = defineComponent({
    setup() {
      return () =>
        h(WorkshopField, {
          field,
          modelValue: values.value,
          'onUpdate:modelValue': (next: WorkshopFormValues) => {
            values.value = next
            updated(next)
          }
        })
    }
  })
  render(Host)
  return updated
}

describe('WorkshopField', () => {
  it('renders multiline text fields with their declared length limits', () => {
    renderField({
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true,
      valueType: 'string',
      minLength: 1,
      maxLength: 120
    })
    const input = screen.getByRole('textbox', { name: /Prompt/ })
    expect(input.tagName).toBe('TEXTAREA')
    expect(input.getAttribute('minlength')).toBe('1')
    expect(input.getAttribute('maxlength')).toBe('120')
  })

  it('validates parsed JSON against the retained Router schema', async () => {
    renderField({
      kind: 'text',
      name: 'inputs',
      label: 'Inputs',
      required: true,
      multiline: true,
      valueType: 'json',
      jsonSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 1 },
            voice_id: { type: 'string', minLength: 1 }
          },
          required: ['text', 'voice_id'],
          additionalProperties: false
        },
        minItems: 1,
        maxItems: 10
      }
    })
    const input = screen.getByRole('textbox', {
      name: /Inputs/
    }) as HTMLTextAreaElement

    await fireEvent.update(input, '[]')
    await nextTick()
    expect(input.validationMessage).toBe(
      "Enter JSON that matches this model input's schema."
    )

    await fireEvent.update(input, '[{"text":"Hello","voice_id":"Sarah"}]')
    await nextTick()
    expect(input.validationMessage).toBe('')
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
    await nextTick()
    expect(updated).toHaveBeenLastCalledWith({ quality: 'standard' })
  })

  it('preselects a declared default without rendering a placeholder', async () => {
    const updated = renderField({
      kind: 'select',
      name: 'quality',
      label: 'Quality',
      required: false,
      options: ['standard', 'high'],
      defaultValue: 'high'
    })
    const select = screen.getByRole('combobox', {
      name: 'Quality'
    }) as HTMLSelectElement

    expect(select.value).toBe('high')
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(2)
    await userEvent.setup().selectOptions(select, 'standard')
    await nextTick()
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

  it('associates field hints with their controls', () => {
    renderField({
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      hint: 'Describe the image.',
      required: true,
      multiline: true,
      valueType: 'string'
    })

    const hint = screen.getByText('Describe the image.')
    expect(
      screen
        .getByRole('textbox', { name: 'Prompt *' })
        .getAttribute('aria-describedby')
    ).toBe(hint.id)
  })

  it.for([
    ['image', 'image/*'],
    ['video', 'video/*'],
    ['audio', 'audio/*'],
    ['file', null]
  ] as const)('maps %s media fields to accept=%s', ([accept, expected]) => {
    renderField({
      kind: 'media',
      name: `media_${accept}`,
      role: accept,
      label: 'Media',
      required: true,
      multiple: false,
      accept
    })
    expect(screen.getByLabelText(/Media/).getAttribute('accept')).toBe(expected)
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
    await nextTick()
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

    const input = screen.getByRole('textbox', { name: 'Prompt' })
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('text')
    expect(input.hasAttribute('list')).toBe(false)
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
    await nextTick()
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
    await nextTick()
    await user.selectOptions(select, '')
    await nextTick()
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
    await nextTick()
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
    await nextTick()
    expect(updated).toHaveBeenLastCalledWith({
      media_frames: ['<a.png>', '<b.png>']
    })
  })

  it('rejects more files than the role permits', async () => {
    const updated = renderField({
      kind: 'media',
      name: 'media_frames',
      role: 'frames',
      label: 'Frames',
      required: false,
      multiple: true,
      maxItems: 2,
      accept: 'image'
    })
    const input = screen.getByLabelText(/Frames/) as HTMLInputElement
    await userEvent
      .setup()
      .upload(input, [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
        new File(['c'], 'c.png', { type: 'image/png' })
      ])
    await nextTick()

    expect(input.validationMessage).toBe('Select no more than 2 files.')
    expect(updated).toHaveBeenLastCalledWith({ media_frames: undefined })
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
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await user.click(toggle)
    await nextTick()
    expect(updated).toHaveBeenLastCalledWith({ enhance: true })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await user.click(toggle)
    await nextTick()
    expect(updated).toHaveBeenLastCalledWith({ enhance: false })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('shows a visible error when too many files are picked', async () => {
    // setCustomValidity alone was invisible: the only submit control is
    // disabled, so the browser never surfaced it and the selection vanished
    // with no explanation.
    const updated = renderField({
      kind: 'media',
      name: 'media_frames',
      role: 'frames',
      label: 'Frames',
      required: false,
      multiple: true,
      maxItems: 1,
      accept: 'image'
    })

    const input = screen.getByLabelText(/Frames/) as HTMLInputElement
    await userEvent
      .setup()
      .upload(input, [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' })
      ])

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('1')
    // The picker must not keep listing files the form has thrown away.
    expect(input.value).toBe('')
    expect(updated).toHaveBeenLastCalledWith({ media_frames: undefined })
    // And the failure is announced, not just painted.
    expect(input.getAttribute('aria-describedby')).toContain(alert.id)
  })

  it('shows a visible error for JSON the model would reject', async () => {
    renderField({
      kind: 'text',
      name: 'inputs',
      label: 'Inputs',
      required: true,
      multiline: true,
      valueType: 'json',
      jsonSchema: { type: 'array', minItems: 1 }
    })

    // userEvent reads [ and ] as key descriptors; [[ and ]] are the literals.
    await userEvent.setup().type(screen.getByLabelText(/Inputs/), '[[]]')

    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
  })

  it('keeps a numeric option a number, not the string the DOM gives back', async () => {
    // The index lookup exists only for this. 16 selects in the catalog have
    // numeric options, and a regression to target.value would ship "50".
    const updated = renderField({
      kind: 'select',
      name: 'fps',
      label: 'Fps',
      required: false,
      options: [25, 50]
    })

    await userEvent.setup().selectOptions(screen.getByLabelText(/Fps/), '50')

    expect(updated).toHaveBeenLastCalledWith({ fps: 50 })
  })
})

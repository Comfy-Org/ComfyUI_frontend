// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import { defaultValues, validateForm } from '../../config/workshop-playground'
import PlaygroundForm from './PlaygroundForm.vue'

describe('Advanced form values', () => {
  it('opens Advanced when a submitted field inside it has an error', async () => {
    const schema: FieldSchema[] = [
      { kind: 'number', name: 'seed', label: 'Seed', step: 1, advanced: true }
    ]
    const errors = ref<FieldErrors>({})
    render(
      defineComponent({
        setup: () => () =>
          h(PlaygroundForm, { schema, modelValue: {}, errors: errors.value })
      })
    )
    const disclosure = screen.getByTestId<HTMLDetailsElement>(
      'playground-advanced'
    )
    expect(disclosure.open).toBe(false)
    errors.value = { seed: 'outOfRange' }
    await nextTick()
    expect(disclosure.open).toBe(true)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('keeps edited typed values when Advanced is closed and validates its hidden fields', async () => {
    const user = userEvent.setup()
    const schema: FieldSchema[] = [
      {
        kind: 'text',
        name: 'prompt',
        label: 'Prompt',
        required: true,
        multiline: true,
        advanced: false
      },
      { kind: 'toggle', name: 'audio', label: 'Audio', advanced: false },
      {
        kind: 'select',
        name: 'fps',
        label: 'FPS',
        options: [25, 50],
        required: true,
        advanced: true
      },
      { kind: 'number', name: 'seed', label: 'Seed', step: 1, advanced: true }
    ]
    const values = ref<FormValues>(defaultValues(schema))
    render(
      defineComponent({
        setup: () => () =>
          h(PlaygroundForm, {
            schema,
            errors: {},
            modelValue: values.value,
            'onUpdate:modelValue': (next: FormValues) => {
              values.value = next
            }
          })
      })
    )
    expect(validateForm(schema, values.value)).toEqual({
      prompt: 'required',
      fps: 'required'
    })
    await user.type(screen.getByTestId('field-prompt'), 'Test prompt')
    await user.selectOptions(screen.getByTestId('field-audio'), 'true')
    await user.click(screen.getByText('Advanced settings'))
    await user.selectOptions(screen.getByTestId('field-fps'), '50')
    await user.type(screen.getByTestId('field-seed'), '100001')
    await user.click(screen.getByText('Advanced settings'))
    expect(values.value).toEqual({
      prompt: 'Test prompt',
      audio: true,
      fps: 50,
      seed: 100001
    })
    expect(validateForm(schema, values.value)).toEqual({})
  })
})

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
import {
  defaultValues,
  schemaForModel,
  validateForm
} from '../../config/workshop-playground'
import { getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { prepareWorkshopRouterInput } from '../../config/workshop-request'
import PlaygroundForm from './PlaygroundForm.vue'

describe('Advanced form values', () => {
  it('starts Seedance with a blank seed and only sends the seed entered in Advanced', async () => {
    const model = getRouterWorkshopModelDetail(
      'byteplus--dreamina-seedance-2-0-fast-260128'
    )
    if (!model?.execution) throw new Error('Missing Seedance test model')
    const contract = model.execution
    const schema = schemaForModel(model)
    const values = ref<FormValues>(defaultValues(schema, model.defaults))
    const prepare = () =>
      prepareWorkshopRouterInput(
        contract,
        values.value,
        new AbortController().signal
      )
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
    const user = userEvent.setup()
    await user.click(screen.getByText('Advanced settings'))
    const seed = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Seed'
    })
    expect(seed.value).toBe('')
    expect(await prepare()).not.toHaveProperty('seed')
    await user.type(seed, '0')
    expect(await prepare()).toHaveProperty('seed', 0)
    await user.clear(seed)
    expect(seed.value).toBe('')
    expect(await prepare()).not.toHaveProperty('seed')
  })

  it('uses the model Resolution dropdown to compose one output without a count control', async () => {
    const model = getRouterWorkshopModelDetail('wan--wan2.5-t2i-preview')
    if (!model?.execution) throw new Error('Missing Wan test model')
    const schema = schemaForModel(model)
    const values = ref<FormValues>(defaultValues(schema, model.defaults))
    render(
      defineComponent({
        setup: () => () =>
          h(PlaygroundForm, {
            schema,
            modelValue: values.value,
            errors: {},
            'onUpdate:modelValue': (next: FormValues) => {
              values.value = next
            }
          })
      })
    )
    const resolution = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Resolution'
    })
    expect(resolution.selectedOptions[0].textContent.trim()).toBe('1280*1280')
    expect(screen.queryByLabelText(/output count|number of images/i)).toBeNull()
    expect(screen.queryByRole('option', { name: '—' })).toBeNull()
    await userEvent
      .setup()
      .selectOptions(
        resolution,
        screen.getByRole('option', { name: '1920*1080' })
      )
    const body = await prepareWorkshopRouterInput(
      model.execution,
      values.value,
      new AbortController().signal
    )
    expect(body).toMatchObject({ parameters: { size: '1920*1080', n: 1 } })
  })

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
    errors.value = {}
    await nextTick()
    expect(disclosure.open).toBe(true)
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

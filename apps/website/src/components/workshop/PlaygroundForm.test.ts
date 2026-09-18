import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
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
import { frameRatioRule } from '../../config/workshop-model-restrictions'
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

describe('First and last frame ratios', () => {
  const SLUG = 'byteplus--seedance-2-5-first-last-frame--animate-images'
  const sizes = new Map<string, { width: number; height: number }>()
  const decoded: string[] = []

  class StubImage {
    onload: (() => void) | null = null
    naturalWidth = 0
    naturalHeight = 0
    #src = ''
    set src(value: string) {
      this.#src = value
      const size = sizes.get(value)
      if (!size) return
      this.naturalWidth = size.width
      this.naturalHeight = size.height
      queueMicrotask(() => {
        decoded.push(value)
        this.onload?.()
      })
    }
    get src(): string {
      return this.#src
    }
  }

  /**
   * Absence proves nothing until the frames have actually been measured: a
   * bare assertion that the notice is missing is satisfied by the tick before
   * the decode, whatever the form would go on to decide.
   */
  async function silentOnceMeasured(...urls: string[]) {
    await waitFor(() => expect(decoded).toEqual(expect.arrayContaining(urls)))
    expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
  }

  function frame(url: string, width: number, height: number): string {
    sizes.set(url, { width, height })
    return url
  }

  beforeEach(() => {
    vi.stubGlobal('Image', StubImage)
  })

  afterEach(() => {
    sizes.clear()
    decoded.length = 0
  })

  function renderForm(values: Ref<FormValues>) {
    const model = getRouterWorkshopModelDetail(SLUG)
    if (!model) throw new Error('Missing first/last frame test model')
    render(
      defineComponent({
        setup: () => () =>
          h(PlaygroundForm, {
            schema: schemaForModel(model),
            errors: {},
            frameRatio: frameRatioRule(SLUG),
            modelValue: values.value,
            'onUpdate:modelValue': (next: FormValues) => {
              values.value = next
            }
          })
      })
    )
  }

  // The rule is keyed to this page by field name, so a rename on either side
  // silently stops the notice. Reading the real schema is what catches that.
  it('names the fields the model actually renders', () => {
    const model = getRouterWorkshopModelDetail(SLUG)
    const rule = frameRatioRule(SLUG)
    if (!model || !rule) throw new Error('Missing first/last frame test model')
    const names = schemaForModel(model).map((field) => field.name)
    expect(names).toContain(rule.first)
    expect(names).toContain(rule.last)
  })

  it('warns about the stretch once both frames are chosen', async () => {
    const values = ref<FormValues>({
      first_frame_url: frame('https://example.com/first.png', 1920, 1080),
      last_frame_url: frame('https://example.com/last.png', 1080, 1920)
    })
    renderForm(values)

    expect(
      (await screen.findByTestId('frame-ratio-notice')).textContent
    ).toContain('first frame')

    values.value = {
      ...values.value,
      last_frame_url: frame('https://example.com/last-match.png', 1280, 720)
    }

    await silentOnceMeasured('https://example.com/last-match.png')
  })

  it('says nothing when the frames share a shape', async () => {
    const values = ref<FormValues>({
      first_frame_url: frame('https://example.com/first.png', 1920, 1080),
      last_frame_url: frame('https://example.com/last.png', 1280, 720)
    })
    renderForm(values)

    await silentOnceMeasured(
      'https://example.com/first.png',
      'https://example.com/last.png'
    )
  })

  // Same mismatched frames, a page the rule was not read for: no notice.
  it('leaves an unrestricted page alone', async () => {
    const model = getRouterWorkshopModelDetail(
      'kling--omni-pro-first-last-frame--animate-images'
    )
    if (!model) throw new Error('Missing Kling test model')
    const values = ref<FormValues>({
      first_frame_url: frame('https://example.com/first.png', 1920, 1080),
      last_frame_url: frame('https://example.com/last.png', 1080, 1920)
    })
    render(
      defineComponent({
        setup: () => () =>
          h(PlaygroundForm, {
            schema: schemaForModel(model),
            errors: {},
            frameRatio: frameRatioRule(model.slug),
            modelValue: values.value,
            'onUpdate:modelValue': () => {}
          })
      })
    )

    await waitFor(() =>
      expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
    )
  })
})

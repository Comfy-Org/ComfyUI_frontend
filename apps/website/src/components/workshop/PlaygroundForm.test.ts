import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, nextTick, ref } from 'vue'

import { frameRatioRule } from '../../config/workshop-model-restrictions'
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
import { prepareWorkshopRouterInput } from '../../config/workshop-request'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import type { FakeImageDecoder } from '../../test/fakeImageDecoder'
import { stubImageDecoder } from '../../test/fakeImageDecoder'
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
  let decoder: FakeImageDecoder

  beforeEach(() => {
    decoder = stubImageDecoder()
  })

  /**
   * Absence proves nothing until the frames have actually been measured: a
   * bare assertion that the notice is missing is satisfied by the tick before
   * the decode, whatever the form would go on to decide.
   */
  async function silentOnceMeasured(...urls: string[]) {
    await waitFor(() =>
      expect(decoder.decoded).toEqual(expect.arrayContaining(urls))
    )
    expect(screen.queryByTestId('frame-ratio-notice')).toBeNull()
  }

  const frame = (url: string, width: number, height: number) =>
    decoder.frame(url, width, height)

  const upload = (label: string) =>
    within(screen.getByRole('group', { name: label })).getByRole('listitem')

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
    ).toContain('different shapes')

    values.value = {
      ...values.value,
      last_frame_url: frame('https://example.com/last-match.png', 1280, 720)
    }

    await silentOnceMeasured('https://example.com/last-match.png')
  })

  // The warning names a consequence; the mark says which of two uploads to go
  // and change. Only the stretched one is marked, and nothing is rejected.
  it('marks the uploaded last frame while the warning stands', async () => {
    const values = ref<FormValues>({
      first_frame_url: frame('https://example.com/first.png', 1920, 1080),
      last_frame_url: frame('https://example.com/last.png', 1080, 1920)
    })
    renderForm(values)
    const notice = await screen.findByTestId('frame-ratio-notice')

    expect(upload('Last frame')).toHaveAttribute('data-attention')
    expect(upload('First frame')).not.toHaveAttribute('data-attention')

    const lastFrame = within(
      screen.getByRole('group', { name: 'Last frame' })
    ).getByLabelText('Last frame')
    expect(lastFrame).toHaveAttribute('aria-invalid', 'false')
    expect(lastFrame.getAttribute('aria-describedby')).toContain(notice.id)

    values.value = {
      ...values.value,
      last_frame_url: frame('https://example.com/last-match.png', 1280, 720)
    }

    await silentOnceMeasured('https://example.com/last-match.png')
    expect(upload('Last frame')).not.toHaveAttribute('data-attention')
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

  // Whatever shape the video ends up with, it has one, and two frames of
  // different shapes cannot both keep theirs. Picking a ratio does not settle
  // that, so it does not retire the warning.
  it('keeps the warning when the reader picks an explicit ratio', async () => {
    const values = ref<FormValues>({
      ratio: 'adaptive',
      first_frame_url: frame('https://example.com/first.png', 1920, 1080),
      last_frame_url: frame('https://example.com/last.png', 1080, 1920)
    })
    renderForm(values)

    await screen.findByTestId('frame-ratio-notice')
    expect(upload('Last frame')).toHaveAttribute('data-attention')

    values.value = { ...values.value, ratio: '9:16' }
    await nextTick()

    expect(screen.getByTestId('frame-ratio-notice')).toBeTruthy()
    expect(upload('Last frame')).toHaveAttribute('data-attention')
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

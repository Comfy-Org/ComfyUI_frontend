// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import type { WorkshopInputDefinition } from '../../config/workshop-input-definition'
import { resolveWorkshopUrlInputs } from '../../config/workshop-url-input'
import {
  defaultValues,
  MAX_UPLOAD_BYTES
} from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import PlaygroundField from './PlaygroundField.vue'

function mountField(
  field: FieldSchema,
  initial: FormValues = {},
  locale: Locale = 'en',
  errors: FieldErrors = {}
) {
  const values = ref<FormValues>(initial)
  render(
    defineComponent({
      setup() {
        return () =>
          h(PlaygroundField, {
            field,
            locale,
            errors,
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
  it.for<FieldSchema>([
    {
      kind: 'text',
      name: 'input',
      label: 'Input',
      required: true,
      multiline: false
    },
    {
      kind: 'text',
      name: 'input',
      label: 'Input',
      required: true,
      multiline: true
    },
    {
      kind: 'select',
      name: 'input',
      label: 'Input',
      required: true,
      options: ['a', 'b']
    },
    { kind: 'number', name: 'input', label: 'Input', required: true, step: 1 },
    { kind: 'toggle', name: 'input', label: 'Input', required: true },
    {
      kind: 'file',
      name: 'input',
      label: 'Input',
      required: true,
      accept: ['image/png'],
      maxBytes: MAX_UPLOAD_BYTES
    }
  ])(
    'exposes the required state of a $kind input to assistive technology',
    (field) => {
      mountField(field)
      const input =
        field.kind === 'file'
          ? screen.getByLabelText('Input', { selector: 'input[type="file"]' })
          : screen.getByRole(
              field.kind === 'text'
                ? 'textbox'
                : field.kind === 'number'
                  ? 'spinbutton'
                  : field.kind === 'toggle'
                    ? 'switch'
                    : 'combobox',
              { name: 'Input' }
            )
      expect(input.getAttribute('aria-required')).toBe('true')
    }
  )

  it('retains a parent cross-field error when the unchanged field loses focus', async () => {
    mountField(
      {
        kind: 'text',
        name: 'input_task_id',
        label: 'Task ID',
        multiline: false,
        required: false
      },
      { input_task_id: 'task-1' },
      'en',
      { input_task_id: 'rejected' }
    )
    const input = screen.getByRole('textbox', { name: 'Task ID' })
    const error = screen.getByRole('alert').textContent
    await userEvent.setup().click(input)
    await userEvent.setup().tab()
    expect(screen.getByRole('alert').textContent).toBe(error)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })
  it.for<{
    media: NonNullable<WorkshopInputDefinition['urlUpload']>
    name: string
    type: string
    multiline: boolean
  }>([
    { media: 'image', name: 'source.png', type: 'image/png', multiline: false },
    { media: 'video', name: 'source.mp4', type: 'video/mp4', multiline: true },
    {
      media: 'audio',
      name: 'source.mp3',
      type: 'audio/mpeg',
      multiline: false
    },
    {
      media: 'image-or-video',
      name: 'source.webm',
      type: 'video/webm',
      multiline: false
    },
    {
      media: 'file',
      name: 'scene.fbx',
      type: 'application/octet-stream',
      multiline: false
    }
  ])(
    'offers uploads only for $media while retaining the example URL',
    async ({ media, name, type, multiline }) => {
      const field: FieldSchema = {
        kind: 'text',
        name: 'source',
        label: 'Source',
        required: true,
        multiline,
        presentation: {
          label: 'Source',
          help: '',
          hidden: false,
          advanced: false,
          control: 'text-box',
          urlUpload: media
        }
      }
      const url = `https://example.com/${name}`
      const values = mountField(field, { source: url })
      const upload = vi.fn(async () => `https://storage.example/${name}`)
      const signal = new AbortController().signal
      expect(screen.queryByRole('textbox', { hidden: true })).toBeNull()
      expect(
        screen.getByRole('button', { name: `Replace ${name}` })
      ).toBeTruthy()
      expect(
        await resolveWorkshopUrlInputs([field], values.value, signal, upload)
      ).toEqual({ source: url })
      expect(values.value.source).toBe(url)
      expect(upload).not.toHaveBeenCalled()

      const file = new File(['source bytes'], name, { type })
      await userEvent
        .setup()
        .upload(
          screen.getByLabelText('Source', { selector: 'input[type="file"]' }),
          file
        )
      expect(values.value.source).toMatchObject({ file, name, type })
      expect(
        await resolveWorkshopUrlInputs([field], values.value, signal, upload)
      ).toEqual({ source: `https://storage.example/${name}` })
      expect(upload).toHaveBeenCalledWith(file, signal)
    }
  )

  it('shows a playable source video when an example URL is prefilled', () => {
    mountField(
      {
        kind: 'text',
        name: 'video',
        label: 'Source video',
        required: true,
        multiline: false,
        presentation: {
          label: 'Source video',
          help: '',
          hidden: false,
          advanced: false,
          control: 'text-box',
          urlUpload: 'video'
        }
      },
      { video: 'https://example.com/source.mp4' }
    )
    const slot = within(screen.getByRole('group', { name: 'Source video' }))
    const player = slot.getByLabelText('source.mp4', { selector: 'video' })
    expect(player.getAttribute('src')).toBe('https://example.com/source.mp4')
    expect(player.hasAttribute('controls')).toBe(true)
    expect(player.getAttribute('preload')).toBe('metadata')
    expect(
      screen
        .getByLabelText('Source video', { selector: 'input[type="file"]' })
        .getAttribute('accept')
    ).toContain('video/mp4')
  })

  it('keeps a prefilled URL as a URL until its occupied upload slot is removed or replaced', async () => {
    const user = userEvent.setup()
    const values = mountField(
      {
        kind: 'text',
        name: 'image_url',
        label: 'Source image',
        required: true,
        multiline: false,
        presentation: {
          label: 'Source image',
          help: '',
          hidden: false,
          advanced: false,
          control: 'text-box',
          imageSource: 'url',
          urlUpload: 'image'
        }
      },
      { image_url: 'https://example.com/start.png' }
    )
    const slot = within(screen.getByRole('group', { name: 'Source image' }))
    expect(slot.getByRole('img').getAttribute('src')).toBe(
      'https://example.com/start.png'
    )
    expect(values.value.image_url).toBe('https://example.com/start.png')
    await user.click(slot.getByRole('button', { name: 'Remove start.png' }))
    expect(values.value.image_url).toBeUndefined()
    expect(slot.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('textbox', { hidden: true })).toBeNull()
    const file = new File(['image'], 'replacement.png', { type: 'image/png' })
    await user.upload(
      slot.getByLabelText('Source image', { selector: 'input[type="file"]' }),
      file
    )
    expect(values.value.image_url).toMatchObject({
      file,
      name: 'replacement.png'
    })
    expect(slot.getByRole('img').getAttribute('alt')).toBe('replacement.png')
  })

  it('keeps a non-image source as a real file while displaying a file card', async () => {
    const user = userEvent.setup()
    const values = mountField({
      kind: 'file',
      name: 'source',
      label: 'Source file',
      required: true,
      accept: [],
      maxBytes: MAX_UPLOAD_BYTES
    })
    const file = new File(['FBX fixture bytes'], 'scene.fbx', {
      type: 'application/octet-stream'
    })
    await user.upload(
      screen.getByLabelText('Source file', { selector: 'input' }),
      file
    )
    expect(screen.getByText('FBX')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Replace scene.fbx' })
    ).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    const stored = values.value.source
    if (!stored || typeof stored !== 'object' || Array.isArray(stored))
      throw new Error('Expected one selected file')
    expect(stored.file).toBeInstanceOf(File)
    expect(stored.file).toMatchObject({
      name: file.name,
      type: file.type,
      size: file.size
    })
    expect(await stored.file?.text()).toBe('FBX fixture bytes')
  })

  it('supports uploads for image URL definitions without separate upload metadata', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const field: FieldSchema = {
      kind: 'text',
      name: 'image',
      label: 'Image to upscale',
      required: true,
      multiline: false,
      inputSchema: { type: 'string', format: 'http-image-url' },
      presentation: {
        label: 'Image to upscale',
        help: '',
        hidden: false,
        advanced: false,
        control: 'text-box',
        imageSource: 'url'
      }
    }
    const values = mountField(field, { image: 'https://example.com/image.png' })
    const input = screen.getByLabelText('Image to upscale', {
      selector: 'input[type="file"]'
    })
    expect(screen.queryByRole('textbox', { hidden: true })).toBeNull()
    expect(
      screen.getByRole('img', { name: 'image.png' }).getAttribute('src')
    ).toBe('https://example.com/image.png')
    await user.upload(
      input,
      new File(['video'], 'video.mp4', { type: 'video/mp4' })
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(values.value.image).toBe('https://example.com/image.png')

    const file = new File(['bytes'], 'local.png', { type: 'image/png' })
    await user.upload(input, file)
    expect(values.value.image).toMatchObject({ name: 'local.png', file })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Replace local.png' })
    ).toBeTruthy()
    const upload = vi.fn(async () => 'https://storage.example/local.png')
    expect(
      await resolveWorkshopUrlInputs(
        [field],
        values.value,
        new AbortController().signal,
        upload
      )
    ).toEqual({ image: 'https://storage.example/local.png' })
    await user.click(screen.getByRole('button', { name: 'Remove local.png' }))
    expect(values.value.image).toBeUndefined()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('required')
  })

  it('keeps non-media text fields editable, including values containing URLs', async () => {
    const values = mountField({
      kind: 'text',
      name: 'website',
      label: 'Website',
      required: false,
      multiline: false
    })
    await userEvent
      .setup()
      .type(
        screen.getByRole('textbox', { name: 'Website' }),
        'https://example.com'
      )
    expect(values.value.website).toBe('https://example.com')
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('shows specialist guidance inline without a help popup', () => {
    const hint =
      'Reuse a seed with the same inputs to make results more repeatable.'
    mountField({
      kind: 'number',
      name: 'seed',
      label: 'Seed',
      step: 1,
      hint
    })
    expect(screen.getByText(hint)).toBeTruthy()
    expect(
      screen.getByRole('spinbutton', { name: 'Seed', description: hint })
    ).toBeTruthy()
    expect(screen.queryByLabelText('About Seed')).toBeNull()
  })

  it('needs no help affordance or description when the label is enough', () => {
    mountField({
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      required: true,
      multiline: true
    })
    expect(
      screen.getByRole('textbox', { name: 'Prompt', description: '' })
    ).toBeTruthy()
    expect(screen.queryByLabelText('About Prompt')).toBeNull()
  })

  it('selects and discloses the duration default without a blank choice, preserving numeric values', async () => {
    const field: FieldSchema = {
      kind: 'select',
      name: 'duration',
      label: 'Duration',
      hint: 'Choose the output length in seconds.',
      options: [-1, 4, 5, 6],
      defaultValue: 5,
      presentation: {
        label: 'Duration',
        help: 'Choose the output length in seconds.',
        hidden: false,
        advanced: false,
        control: 'dropdown',
        defaultSource: 'curated',
        unit: 'seconds'
      }
    }
    const values = mountField(field, defaultValues([field]))
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Duration'
    })
    expect(select.selectedOptions[0].textContent.trim()).toBe('5 seconds')
    expect(screen.getByText('Default: 5 seconds')).toBeTruthy()
    expect(select.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'help-duration',
      'default-duration'
    ])
    const user = userEvent.setup()
    await user.selectOptions(
      select,
      screen.getByRole('option', { name: '6 seconds' })
    )
    expect(values.value.duration).toBe(6)
    await user.selectOptions(
      select,
      screen.getByRole('option', { name: 'Auto' })
    )
    expect(values.value.duration).toBe(-1)
    expect(screen.queryByRole('option', { name: '—' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Choose Duration' })).toBeNull()
  })

  it('labels native duration strings in seconds without changing their wire values', async () => {
    const field: FieldSchema = {
      kind: 'select',
      name: 'duration',
      label: 'Duration',
      options: ['5s', '9s'],
      defaultValue: '5s',
      presentation: {
        label: 'Duration',
        help: '',
        hidden: false,
        advanced: false,
        control: 'dropdown',
        unit: 'seconds'
      }
    }
    const values = mountField(field, defaultValues([field]))
    expect(screen.getByText('Default: 5 seconds')).toBeTruthy()
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Duration' }),
        screen.getByRole('option', { name: '9 seconds' })
      )
    expect(values.value.duration).toBe('9s')
  })

  it('uses a float slider only with known bounds and preserves fractional input', async () => {
    const field: FieldSchema = {
      kind: 'number',
      name: 'creativity',
      label: 'Creativity',
      min: 0,
      max: 1,
      step: 'any',
      defaultValue: 0.125,
      presentation: {
        label: 'Creativity',
        help: 'Adjust variation.',
        hidden: false,
        advanced: true,
        control: 'slider',
        defaultSource: 'router'
      }
    }
    const values = mountField(field, defaultValues([field]))
    const slider = screen.getByRole('slider', { name: 'Creativity' })
    await fireEvent.update(slider, '0.333')
    expect(values.value.creativity).toBe(0.333)
    expect(screen.queryByRole('alert')).toBeNull()
    const number = mountField({
      kind: 'number',
      name: 'count',
      label: 'Count',
      min: 1,
      step: 1
    })
    const input = screen.getByRole('spinbutton', { name: 'Count' })
    await userEvent.setup().type(input, '27')
    expect(number.value.count).toBe(27)
  })

  it('discloses zero and false defaults, localized, without treating them as missing', async () => {
    const field: FieldSchema = {
      kind: 'number',
      name: 'seed',
      label: 'Seed',
      defaultValue: 0,
      step: 1
    }
    const seed = mountField(field, defaultValues([field]), 'zh-CN')
    expect(screen.getByText('默认值：0')).toBeTruthy()
    expect(seed.value.seed).toBe(0)
    const toggle: FieldSchema = {
      kind: 'toggle',
      name: 'audio',
      label: 'Audio',
      defaultValue: false
    }
    const audio = mountField(toggle, defaultValues([toggle]), 'zh-CN')
    expect(screen.getByText('默认值：关闭')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Audio' }))
    expect(audio.value.audio).toBe(true)
  })

  it('shows and clears localized validation errors without submitting a run', async () => {
    const user = userEvent.setup()
    mountField({
      kind: 'text',
      name: 'items',
      label: 'Items',
      required: false,
      multiline: true,
      valueType: 'json',
      jsonSchema: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 1
      }
    })
    await user.type(screen.getByTestId('field-items'), 'not json')
    expect(screen.getByRole('alert').textContent).toBeTruthy()
    expect(
      screen.getByTestId('field-items').getAttribute('aria-describedby')
    ).toBe('error-items')
    await user.clear(screen.getByTestId('field-items'))
    await user.type(screen.getByTestId('field-items'), '[[]')
    expect(screen.getByRole('alert')).toBeTruthy()
    await user.clear(screen.getByTestId('field-items'))
    await user.type(screen.getByTestId('field-items'), '[["one"]')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('accepts Unicode text up to the schema character limit', async () => {
    const user = userEvent.setup()
    const values = mountField({
      kind: 'text',
      name: 'label',
      label: 'Label',
      required: false,
      multiline: false,
      maxLength: 2
    })
    await user.type(screen.getByTestId('field-label'), '🌻🌸')
    expect(values.value.label).toBe('🌻🌸')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.type(screen.getByTestId('field-label'), '🌼')
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('distinguishes an omitted optional boolean from explicit false', async () => {
    const user = userEvent.setup()
    const values = mountField({
      kind: 'toggle',
      name: 'enhance',
      label: 'Enhance'
    })
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', { name: 'Enhance' }).value
    ).toBe('')
    await user.selectOptions(screen.getByTestId('field-enhance'), 'false')
    expect(values.value.enhance).toBe(false)
    await user.selectOptions(screen.getByTestId('field-enhance'), 'true')
    expect(values.value.enhance).toBe(true)
    await user.selectOptions(screen.getByTestId('field-enhance'), '')
    expect(values.value.enhance).toBeUndefined()
  })

  it('preserves numeric options and clears an optional number without inventing zero', async () => {
    const user = userEvent.setup()
    const values = mountField({
      kind: 'select',
      name: 'fps',
      label: 'FPS',
      options: [25, 50]
    })
    await user.selectOptions(screen.getByTestId('field-fps'), '50')
    expect(values.value.fps).toBe(50)
    const number = mountField({
      kind: 'number',
      name: 'seed',
      label: 'Seed',
      step: 1
    })
    await user.type(screen.getByTestId('field-seed'), '123456')
    expect(number.value.seed).toBe(123456)
    await user.clear(screen.getByTestId('field-seed'))
    expect(number.value.seed).toBeUndefined()
  })

  it('retains every selected File for an eventual upload, not just its metadata', async () => {
    const user = userEvent.setup()
    const values = mountField({
      kind: 'file',
      name: 'images',
      label: 'Images',
      accept: ['image/png'],
      maxBytes: MAX_UPLOAD_BYTES,
      required: true,
      multiple: true
    })
    const first = new File(['first image bytes'], 'first.png', {
      type: 'image/png'
    })
    const second = new File(['second image bytes'], 'second.png', {
      type: 'image/png'
    })
    await user.upload(screen.getByTestId('field-images'), [first, second])
    const files = values.value.images
    if (!Array.isArray(files)) throw new Error('Expected multiple files')
    expect(files.map((value) => value.file)).toEqual([first, second])
    expect(await files[0].file?.text()).toBe('first image bytes')
    expect(screen.getByRole('img', { name: 'first.png' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'second.png' })).toBeTruthy()
  })

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
    await user.click(
      screen.getByRole('button', { name: 'Remove demo-image.webp' })
    )
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

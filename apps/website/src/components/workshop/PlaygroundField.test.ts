// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { FieldSchema, FormValues } from '../../config/workshop-playground'
import {
  defaultValues,
  MAX_UPLOAD_BYTES
} from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import PlaygroundField from './PlaygroundField.vue'

function mountField(
  field: FieldSchema,
  initial: FormValues = {},
  locale: Locale = 'en'
) {
  const values = ref<FormValues>(initial)
  render(
    defineComponent({
      setup() {
        return () =>
          h(PlaygroundField, {
            field,
            locale,
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

  it('shows URL image previews and inline validation without offering a fake upload', async () => {
    const user = userEvent.setup()
    const values = mountField({
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
    })
    const input = screen.getByRole('textbox', { name: 'Image to upscale' })
    await user.type(input, 'https://')
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter a complete http:// or https:// image URL.'
    )
    expect(screen.queryByRole('img')).toBeNull()
    await user.type(input, 'example.com/image.png')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByRole('img', { name: 'Image to upscale' }).getAttribute('src')
    ).toBe('https://example.com/image.png')
    expect(values.value.image).toBe('https://example.com/image.png')
    expect(screen.queryByText('Choose images or drop them here')).toBeNull()
    await user.clear(input)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('required')
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
    await fireEvent.input(slider, { target: { value: '0.333' } })
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

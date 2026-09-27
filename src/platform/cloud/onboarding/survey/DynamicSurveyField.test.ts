import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { OnboardingSurveyField } from '@/platform/remoteConfig/types'

import DynamicSurveyField from './DynamicSurveyField.vue'

const renderField = (
  field: OnboardingSurveyField,
  props: {
    modelValue?: string | string[]
    otherValue?: string
    errorMessage?: string
  } = {},
  locale = 'en'
) =>
  render(DynamicSurveyField, {
    global: {
      plugins: [
        createI18n({ legacy: false, locale, messages: { en: enMessages } })
      ]
    },
    props: { field, modelValue: undefined, ...props }
  })

const optionButton = (label: string) =>
  screen.getByRole('button', { name: label })

describe('DynamicSurveyField', () => {
  const singleField: OnboardingSurveyField = {
    id: 'intent',
    type: 'single',
    label: 'What do you want to make?',
    required: true,
    options: [
      { value: 'images', label: 'Images', icon: 'icon-[lucide--image]' },
      { value: 'video', label: 'Video' }
    ]
  }

  it('renders the label and one card per option', () => {
    renderField(singleField)
    expect(screen.getByText('What do you want to make?')).toBeVisible()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
  })

  it('emits the chosen value for a single-select card', async () => {
    const user = userEvent.setup()
    const { emitted } = renderField(singleField)

    await user.click(screen.getByText('Images'))
    expect(emitted()['update:modelValue']?.[0]).toEqual(['images'])
  })

  it('marks the selected single card as on (aria-pressed/state)', () => {
    renderField(singleField, { modelValue: 'images' })
    expect(optionButton('Images')).toHaveAttribute('data-state', 'on')
    expect(optionButton('Video')).toHaveAttribute('data-state', 'off')
  })

  it('gives each option card a stable "<fieldId>-<value>" id', () => {
    renderField(singleField)
    expect(optionButton('Images')).toHaveAttribute('id', 'intent-images')
    expect(optionButton('Video')).toHaveAttribute('id', 'intent-video')
  })

  const multiField: OnboardingSurveyField = {
    id: 'making',
    type: 'multi',
    label: 'Pick some',
    required: true,
    options: [
      { value: 'a', label: 'Making A' },
      { value: 'b', label: 'Making B' }
    ]
  }

  it('emits an array for a multi-select card and reflects current selection', async () => {
    const user = userEvent.setup()
    const { emitted } = renderField(multiField, { modelValue: ['a'] })

    expect(optionButton('Making A')).toHaveAttribute('data-state', 'on')
    await user.click(screen.getByText('Making B'))
    const events = emitted()['update:modelValue'] as unknown[][] | undefined
    const last = events?.at(-1)?.[0]
    expect(last).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('shows the "other" free-text input only when "other" is selected and emits it', async () => {
    const user = userEvent.setup()
    const otherField: OnboardingSurveyField = {
      id: 'source',
      type: 'single',
      label: 'How did you find us?',
      required: true,
      allowOther: true,
      otherFieldId: 'sourceOther',
      options: [
        { value: 'search', label: 'Web search' },
        { value: 'other', label: 'Somewhere else' }
      ]
    }

    const { rerender, emitted } = renderField(otherField, {
      modelValue: 'search'
    })
    expect(
      screen.queryByPlaceholderText('Where did you find us?')
    ).not.toBeInTheDocument()

    await rerender({ field: otherField, modelValue: 'other', otherValue: '' })
    const input = screen.getByPlaceholderText('Where did you find us?')
    await user.type(input, 'A podcast')
    expect(emitted()['update:otherValue']?.length).toBeGreaterThan(0)
  })

  it('renders a text field and emits typed input', async () => {
    const user = userEvent.setup()
    const textField: OnboardingSurveyField = {
      id: 'note',
      type: 'text',
      label: 'Anything else?',
      placeholder: 'Your note'
    }
    const { emitted } = renderField(textField)

    await user.type(screen.getByPlaceholderText('Your note'), 'Hi')
    expect(emitted()['update:modelValue']?.length).toBeGreaterThan(0)
  })

  it('resolves labels via labelKey, locale map, and falls back to the value', () => {
    renderField(
      {
        id: 'q',
        type: 'single',
        labelKey: 'cloudSurvey_steps_intent',
        options: [
          { value: 'x', label: { en: 'Ex', ko: '엑스' } },
          { value: 'raw' } // no label → falls back to the value
        ]
      },
      {}
    )
    expect(screen.getByText('What do you want to make?')).toBeVisible()
    expect(screen.getByText('Ex')).toBeInTheDocument()
    expect(screen.getByText('raw')).toBeInTheDocument()
  })

  it('resolves a field label from a locale map when no labelKey is set', () => {
    renderField({
      id: 'q',
      type: 'single',
      label: { en: 'Server question', ko: '서버 질문' },
      options: [{ value: 'a', label: 'A' }]
    })
    expect(screen.getByText('Server question')).toBeVisible()
  })

  it('falls back to the field id when neither labelKey nor label resolves', () => {
    renderField({
      id: 'bare_field_id',
      type: 'single',
      options: [{ value: 'a', label: 'A' }]
    })
    expect(screen.getByText('bare_field_id')).toBeVisible()
  })

  it('renders the error message when provided', () => {
    renderField(singleField, { errorMessage: 'Please choose an option.' })
    expect(screen.getByText('Please choose an option.')).toBeVisible()
  })
})

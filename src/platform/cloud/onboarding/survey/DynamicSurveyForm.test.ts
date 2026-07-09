import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

import DynamicSurveyForm from './DynamicSurveyForm.vue'
import { defaultOnboardingSurvey } from './defaultSurveySchema'

const renderForm = (survey: OnboardingSurvey) =>
  render(DynamicSurveyForm, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    },
    props: { survey }
  })

const clickOption = (user: ReturnType<typeof userEvent.setup>, label: string) =>
  user.click(screen.getByText(label))

const firstSubmitPayload = (
  emitted: Record<string, unknown[]>
): Record<string, unknown> | undefined =>
  (emitted.submit?.[0] as [Record<string, unknown>] | undefined)?.[0]

const twoStepSurvey: OnboardingSurvey = {
  version: 1,
  fields: [
    {
      id: 'intent',
      type: 'single',
      label: 'What do you want to make?',
      required: true,
      options: [
        { value: 'images', label: 'Images' },
        { value: 'video', label: 'Video' }
      ]
    },
    {
      id: 'making',
      type: 'multi',
      label: 'Pick everything that applies',
      required: true,
      options: [
        { value: 'a', label: 'Making A' },
        { value: 'b', label: 'Making B' }
      ]
    }
  ]
}

const branchedSurvey: OnboardingSurvey = {
  version: 1,
  fields: [
    {
      id: 'intent',
      type: 'single',
      label: 'What do you want to make?',
      required: true,
      options: [
        { value: 'workflows', label: 'Workflows' },
        { value: 'images', label: 'Images' }
      ]
    },
    {
      id: 'focus',
      type: 'single',
      label: 'What are you building?',
      required: true,
      showWhen: { field: 'intent', equals: 'workflows' },
      options: [{ value: 'custom_nodes', label: 'Custom nodes' }]
    }
  ]
}

describe('DynamicSurveyForm', () => {
  it('renders the real default schema (v3) with its first question and options', () => {
    expect(defaultOnboardingSurvey.version).toBe(3)
    const firstField = defaultOnboardingSurvey.fields[0]!
    renderForm(defaultOnboardingSurvey)

    expect(screen.getByText('What do you want to make?')).toBeVisible()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(
      firstField.options!.length
    )
  })

  it('auto-advances when a single-select option is chosen', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    // No Next click — choosing the card advances the wizard.
    await clickOption(user, 'Images')

    expect(
      await screen.findByText('Pick everything that applies')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('does not auto-advance a multi-select step; Submit gates on a choice', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    await clickOption(user, 'Images')

    const submit = await screen.findByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    await clickOption(user, 'Making A')
    // Still on the multi step (no auto-advance), now submittable.
    expect(screen.getByText('Pick everything that applies')).toBeVisible()
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('navigates back to the previous step', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    await clickOption(user, 'Images')
    expect(
      await screen.findByText('Pick everything that applies')
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('What do you want to make?')).toBeVisible()
  })

  it('offers Next on an already-answered single-select reached via Back', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    await clickOption(user, 'Images')
    await screen.findByText('Pick everything that applies')
    await user.click(screen.getByRole('button', { name: 'Back' }))

    const next = await screen.findByRole('button', { name: 'Next' })
    await user.click(next)
    expect(
      await screen.findByText('Pick everything that applies')
    ).toBeVisible()
  })

  it('reveals a branched follow-up step from the answer and submits it', async () => {
    const user = userEvent.setup()
    const { emitted } = renderForm(branchedSurvey)

    await clickOption(user, 'Workflows')
    expect(await screen.findByText('What are you building?')).toBeVisible()

    await clickOption(user, 'Custom nodes')
    await user.click(await screen.findByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(firstSubmitPayload(emitted())).toEqual({
        intent: 'workflows',
        focus: 'custom_nodes'
      })
    )
  })

  it('hides the branched step when the answer does not match', async () => {
    const user = userEvent.setup()
    const { emitted } = renderForm(branchedSurvey)

    // 'images' is the last visible step (focus hidden) → Submit, no branch.
    await clickOption(user, 'Images')
    const submit = await screen.findByRole('button', { name: 'Submit' })
    expect(screen.queryByText('What are you building?')).not.toBeInTheDocument()

    await user.click(submit)
    await waitFor(() =>
      expect(firstSubmitPayload(emitted())).toEqual({
        intent: 'images',
        focus: ''
      })
    )
  })

  it('requires the "other" free-text before submitting, then submits it', async () => {
    const user = userEvent.setup()
    const otherSurvey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
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
      ]
    }
    const { emitted } = renderForm(otherSurvey)

    // Selecting 'other' must NOT auto-advance — the text box is required.
    await clickOption(user, 'Somewhere else')
    const submit = await screen.findByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()

    await user.type(
      await screen.findByPlaceholderText('Where did you find us?'),
      'A newsletter'
    )
    await waitFor(() => expect(submit).toBeEnabled())

    await user.click(submit)
    await waitFor(() =>
      expect(firstSubmitPayload(emitted())).toEqual({ source: 'A newsletter' })
    )
  })

  it('surfaces the free-text error once "other" text is touched then cleared', async () => {
    const user = userEvent.setup()
    const otherSurvey: OnboardingSurvey = {
      version: 1,
      fields: [
        {
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
      ]
    }
    renderForm(otherSurvey)

    await clickOption(user, 'Somewhere else')
    const input = await screen.findByPlaceholderText('Where did you find us?')
    // Type then clear → the free-text field is touched but empty, so its
    // required error surfaces.
    await user.type(input, 'x')
    await user.clear(input)
    expect(
      await screen.findByText('Please describe your answer.')
    ).toBeVisible()
  })

  it('shows a required-field error only after the user interacts, not before', async () => {
    const user = userEvent.setup()
    renderForm({
      version: 1,
      fields: [
        {
          id: 'making',
          type: 'multi',
          label: 'Pick everything that applies',
          required: true,
          options: [{ value: 'a', label: 'Making A' }]
        }
      ]
    })

    // No error on first render (field untouched).
    expect(
      screen.queryByText('Please select at least one option.')
    ).not.toBeInTheDocument()

    // Select then clear → field is touched but empty → error surfaces.
    await user.click(screen.getByText('Making A'))
    await user.click(screen.getByText('Making A'))
    expect(
      await screen.findByText('Please select at least one option.')
    ).toBeVisible()
  })

  it('allows advancing past an optional field while still empty', async () => {
    const user = userEvent.setup()
    renderForm({
      version: 1,
      fields: [
        {
          id: 'q1',
          type: 'single',
          label: 'Optional question?',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' }
          ]
          // no required: true — should be skippable
        },
        {
          id: 'q2',
          type: 'single',
          label: 'Required question?',
          required: true,
          options: [{ value: 'c', label: 'C' }]
        }
      ]
    })

    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeEnabled()

    await user.click(next)
    expect(await screen.findByText('Required question?')).toBeVisible()
  })

  it('resets to the first step when the survey prop changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(DynamicSurveyForm, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      },
      props: { survey: twoStepSurvey }
    })

    await clickOption(user, 'Images')
    expect(
      await screen.findByText('Pick everything that applies')
    ).toBeVisible()

    await rerender({ survey: branchedSurvey })
    // Back on step 0 of the new survey (no Back button on the first step).
    expect(await screen.findByText('What do you want to make?')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Back' })
    ).not.toBeInTheDocument()
  })

  it('renders server-supplied label translations and falls back to English', () => {
    render(DynamicSurveyForm, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'ko',
            fallbackLocale: 'en',
            messages: { en: enMessages, ko: { g: { next: '다음' } } }
          })
        ]
      },
      props: {
        survey: {
          version: 1,
          fields: [
            {
              id: 'intent',
              type: 'single',
              label: { en: 'What will you make?', ko: '무엇을 만들 건가요?' },
              required: true,
              options: [
                // ko provided → localized; ko missing → English fallback
                { value: 'images', label: { en: 'Images', ko: '이미지' } },
                { value: 'video', label: { en: 'Video' } }
              ]
            }
          ]
        }
      }
    })

    expect(screen.getByText('무엇을 만들 건가요?')).toBeVisible()
    expect(screen.getByText('이미지')).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
  })
})

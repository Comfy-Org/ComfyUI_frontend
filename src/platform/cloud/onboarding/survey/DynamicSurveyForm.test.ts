import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { OnboardingSurvey } from '@/platform/remoteConfig/types'

import DynamicSurveyForm from './DynamicSurveyForm.vue'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { back: 'Back', next: 'Next', submit: 'Submit' },
      cloudOnboarding: {
        survey: {
          intro: 'Help us tailor your ComfyUI experience.',
          errors: {
            chooseAnOption: 'Please choose an option.',
            selectAtLeastOne: 'Please select at least one option.',
            describeAnswer: 'Please describe your answer.'
          }
        }
      }
    }
  }
})

const renderForm = (survey: OnboardingSurvey) =>
  render(DynamicSurveyForm, {
    global: { plugins: [PrimeVue, i18n] },
    props: { survey }
  })

const twoStepSurvey: OnboardingSurvey = {
  version: 1,
  introKey: 'cloudOnboarding.survey.intro',
  fields: [
    {
      id: 'usage',
      type: 'single',
      label: 'How do you plan to use ComfyUI?',
      required: true,
      options: [
        { value: 'personal', label: 'Personal use' },
        { value: 'work', label: 'Work' }
      ]
    },
    {
      id: 'intent',
      type: 'multi',
      label: 'What do you want to create with ComfyUI?',
      required: true,
      options: [
        { value: 'images', label: 'Images' },
        { value: 'videos', label: 'Videos' }
      ]
    }
  ]
}

describe('DynamicSurveyForm', () => {
  it('renders the intro text and the first field options', () => {
    renderForm(twoStepSurvey)

    expect(
      screen.getByText('Help us tailor your ComfyUI experience.')
    ).toBeInTheDocument()
    expect(screen.getByText('How do you plan to use ComfyUI?')).toBeVisible()
    expect(screen.getByLabelText('Personal use')).toBeInTheDocument()
    expect(screen.getByLabelText('Work')).toBeInTheDocument()
  })

  it('disables Next until the user selects an option, then advances', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeDisabled()

    await user.click(screen.getByLabelText('Personal use'))
    expect(next).toBeEnabled()

    await user.click(next)
    await flushPromises()

    expect(
      screen.getByText('What do you want to create with ComfyUI?')
    ).toBeVisible()
    expect(screen.getByLabelText('Images')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('navigates back to the previous step', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    await user.click(screen.getByLabelText('Personal use'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await flushPromises()
    expect(
      screen.getByText('What do you want to create with ComfyUI?')
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await flushPromises()
    expect(screen.getByText('How do you plan to use ComfyUI?')).toBeVisible()
  })

  it('resolves option and field labels via labelKey when provided', () => {
    const localizedI18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: { back: 'Back', next: 'Next', submit: 'Submit' },
          cloudOnboarding: {
            survey: {
              intro: 'Help us tailor your ComfyUI experience.',
              errors: {
                chooseAnOption: '',
                selectAtLeastOne: '',
                describeAnswer: ''
              }
            }
          },
          survey_label: 'Localized question?',
          survey_a: 'Localized A',
          survey_b: 'Localized B'
        }
      }
    })

    render(DynamicSurveyForm, {
      global: { plugins: [PrimeVue, localizedI18n] },
      props: {
        survey: {
          version: 1,
          fields: [
            {
              id: 'q',
              type: 'single',
              labelKey: 'survey_label',
              required: true,
              options: [
                { value: 'a', labelKey: 'survey_a' },
                { value: 'b', labelKey: 'survey_b' }
              ]
            }
          ]
        }
      }
    })

    expect(screen.getByText('Localized question?')).toBeVisible()
    expect(screen.getByLabelText('Localized A')).toBeInTheDocument()
    expect(screen.getByLabelText('Localized B')).toBeInTheDocument()
  })

  it('renders server-supplied translations from a label locale map', () => {
    const koreanI18n = createI18n({
      legacy: false,
      locale: 'ko',
      fallbackLocale: 'en',
      messages: {
        en: {
          g: { back: 'Back', next: 'Next', submit: 'Submit' },
          cloudOnboarding: {
            survey: {
              intro: '',
              errors: {
                chooseAnOption: '',
                selectAtLeastOne: '',
                describeAnswer: ''
              }
            }
          }
        },
        ko: { g: { back: '뒤로', next: '다음', submit: '제출' } }
      }
    })

    render(DynamicSurveyForm, {
      global: { plugins: [PrimeVue, koreanI18n] },
      props: {
        survey: {
          version: 1,
          fields: [
            {
              id: 'usage',
              type: 'single',
              label: {
                en: 'How will you use it?',
                ko: '어떻게 사용하시겠어요?'
              },
              required: true,
              options: [
                {
                  value: 'personal',
                  label: { en: 'Personal use', ko: '개인 용도' }
                },
                { value: 'work', label: { en: 'Work', ko: '업무' } }
              ]
            }
          ]
        }
      }
    })

    expect(screen.getByText('어떻게 사용하시겠어요?')).toBeVisible()
    expect(screen.getByLabelText('개인 용도')).toBeInTheDocument()
    expect(screen.getByLabelText('업무')).toBeInTheDocument()
  })

  it('falls back to English when current locale missing from label map', () => {
    const fallbackI18n = createI18n({
      legacy: false,
      locale: 'fr',
      fallbackLocale: 'en',
      messages: {
        en: {
          g: { back: 'Back', next: 'Next', submit: 'Submit' },
          cloudOnboarding: {
            survey: {
              intro: '',
              errors: {
                chooseAnOption: '',
                selectAtLeastOne: '',
                describeAnswer: ''
              }
            }
          }
        },
        fr: {}
      }
    })

    render(DynamicSurveyForm, {
      global: { plugins: [PrimeVue, fallbackI18n] },
      props: {
        survey: {
          version: 1,
          fields: [
            {
              id: 'q',
              type: 'single',
              label: { en: 'English question', ko: '한국어' },
              required: true,
              options: [
                { value: 'a', label: { en: 'English A', ko: '한국어 A' } }
              ]
            }
          ]
        }
      }
    })

    // fr is not in the map → falls back to en
    expect(screen.getByText('English question')).toBeVisible()
    expect(screen.getByLabelText('English A')).toBeInTheDocument()
  })

  it('allows advancing past an optional field while still empty', async () => {
    const user = userEvent.setup()
    render(DynamicSurveyForm, {
      global: { plugins: [PrimeVue, i18n] },
      props: {
        survey: {
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
        }
      }
    })

    const next = screen.getByRole('button', { name: 'Next' })
    expect(next).toBeEnabled()

    await user.click(next)
    await flushPromises()
    expect(screen.getByText('Required question?')).toBeVisible()
  })

  it('enables Submit only after the multi-select field has at least one choice', async () => {
    const user = userEvent.setup()
    renderForm(twoStepSurvey)

    await user.click(screen.getByLabelText('Work'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await flushPromises()

    const submitBtn = screen.getByRole('button', { name: 'Submit' })
    expect(submitBtn).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Images/i }))
    await flushPromises()
    expect(submitBtn).toBeEnabled()
  })
})

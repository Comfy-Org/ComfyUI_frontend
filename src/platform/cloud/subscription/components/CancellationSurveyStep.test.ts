import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { CancellationSurveyExit } from '@/platform/cloud/subscription/utils/cancellationSurvey'
import { useTelemetry } from '@/platform/telemetry'

import CancellationSurveyStep from './CancellationSurveyStep.vue'

vi.mock(import('@/platform/telemetry'))

const REASON_QUESTION_ID = 'f5b2934c-a2aa-4e9d-83d2-bbb346b2a196'
const COMMENT_QUESTION_ID = '3a3166fb-c479-439b-8c8a-65dde9f2147a'

function renderSurvey({
  experimentVariant
}: { experimentVariant?: string } = {}) {
  const onExit = vi.fn<(exit: CancellationSurveyExit) => void>()
  render(CancellationSurveyStep, {
    props: { surveyId: 'survey-1', experimentVariant, onExit },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  return { onExit, user: userEvent.setup() }
}

function surveyEvents() {
  return vi.mocked(useTelemetry()!.trackInAppSurvey).mock.calls
}

describe('CancellationSurveyStep', () => {
  it('asks why and records that the survey was shown to its arm', () => {
    renderSurvey({ experimentVariant: 'control' })

    expect(
      screen.getByRole('heading', { name: 'Why are you cancelling?' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(surveyEvents()).toEqual([
      [
        'shown',
        { surveyId: 'survey-1', properties: { experiment_variant: 'control' } }
      ]
    ])
  })

  it('sends the chosen reason and comment, then continues cancelling', async () => {
    const { onExit, user } = renderSurvey({
      experimentVariant: 'save_30_next_3_v1'
    })

    await user.click(screen.getByRole('radio', { name: 'Too expensive' }))
    await user.type(
      screen.getByLabelText('Anything else you want to share? (optional)'),
      '  Budget cuts  '
    )
    await user.click(
      screen.getByRole('button', { name: 'Continue cancelling' })
    )

    expect(
      screen.getByRole('radio', { name: 'Too expensive' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(surveyEvents()[1]).toEqual([
      'sent',
      {
        surveyId: 'survey-1',
        responses: {
          [REASON_QUESTION_ID]: 'Too expensive',
          [COMMENT_QUESTION_ID]: 'Budget cuts'
        },
        properties: {
          outcome: 'continue_cancelling',
          experiment_variant: 'save_30_next_3_v1'
        }
      }
    ])
    expect(onExit).toHaveBeenCalledExactlyOnceWith('continue_cancelling')
  })

  it.for([
    { action: 'Keep my plan', exit: 'keep_plan' },
    { action: 'Close', exit: 'closed' },
    { action: 'Continue cancelling', exit: 'continue_cancelling' }
  ] as const)(
    'records an unanswered survey as dismissed on $action',
    async ({ action, exit }) => {
      const { onExit, user } = renderSurvey()

      await user.type(
        screen.getByLabelText('Anything else you want to share? (optional)'),
        '   '
      )
      await user.click(screen.getByRole('button', { name: action }))

      expect(surveyEvents()[1]).toEqual([
        'dismissed',
        { surveyId: 'survey-1', properties: { outcome: exit } }
      ])
      expect(onExit).toHaveBeenCalledExactlyOnceWith(exit)
    }
  )

  it('sends an answer given before keeping the plan', async () => {
    const { onExit, user } = renderSurvey()

    await user.click(screen.getByRole('radio', { name: 'Not using it enough' }))
    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))

    expect(surveyEvents()[1]).toEqual([
      'sent',
      {
        surveyId: 'survey-1',
        responses: { [REASON_QUESTION_ID]: 'Not using it enough' },
        properties: { outcome: 'keep_plan' }
      }
    ])
    expect(onExit).toHaveBeenCalledExactlyOnceWith('keep_plan')
  })
})

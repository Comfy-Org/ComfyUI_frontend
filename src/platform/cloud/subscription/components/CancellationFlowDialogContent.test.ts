import type { RetentionFlowResponse } from '@comfyorg/ingest-types'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
import { computed, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { CancellationSurveyExit } from '@/platform/cloud/subscription/utils/cancellationSurvey'
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDialogStore } from '@/stores/dialogStore'

import CancellationFlowDialogContent from './CancellationFlowDialogContent.vue'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

const CancellationSurveyStep = defineComponent({
  props: {
    surveyId: { type: String, required: true },
    experimentVariant: { type: String, default: undefined },
    onExit: {
      type: Function as PropType<(exit: CancellationSurveyExit) => void>,
      required: true
    }
  },
  setup(props) {
    return () =>
      h('div', [
        h('p', `Survey ${props.surveyId} (${props.experimentVariant})`),
        h(
          'button',
          { onClick: () => props.onExit('continue_cancelling') },
          'Survey continue'
        ),
        h('button', { onClick: () => props.onExit('keep_plan') }, 'Survey keep')
      ])
  }
})

const outcomes: RetentionOfferOutcome[] = [
  'continueToCancel',
  'retained',
  'pending',
  'dismissed'
]

const RetentionOfferStep = defineComponent({
  props: {
    sessionId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    onDecide: {
      type: Function as PropType<(outcome: RetentionOfferOutcome) => void>,
      required: true
    }
  },
  setup(props) {
    return () =>
      h('div', [
        h('p', `Offer ${props.sessionId} for ${props.workspaceId}`),
        ...outcomes.map((outcome) =>
          h('button', { onClick: () => props.onDecide(outcome) }, outcome)
        )
      ])
  }
})

const CancelSubscriptionDialogContent = defineComponent({
  props: {
    cancelAt: { type: String, default: undefined },
    flowAlreadyOpened: { type: Boolean, default: false }
  },
  setup(props) {
    return () =>
      h(
        'p',
        `Confirm until ${props.cancelAt}, opened: ${props.flowAlreadyOpened}`
      )
  }
})

const offer = {
  id: 'save_30_next_3_v1',
  percent_off: 30,
  duration_in_months: 3
}

function retentionFlow(
  overrides: Partial<RetentionFlowResponse> = {}
): RetentionFlowResponse {
  return {
    session_id: 'session-1',
    expires_at: 2_000_000_000,
    subscription: {
      currency: 'usd',
      unit_amount: 10000,
      quantity: 1,
      period_end: 2_000_000_000
    },
    ...overrides
  }
}

function renderFlow({
  surveyId,
  flow = null
}: { surveyId?: string; flow?: RetentionFlowResponse | null } = {}) {
  const result = render(CancellationFlowDialogContent, {
    props: {
      cancelAt: '2026-11-12T00:00:00Z',
      surveyId,
      flow,
      workspaceId: 'workspace-1',
      isScopeCurrent: () => true
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ],
      stubs: {
        CancellationSurveyStep,
        RetentionOfferStep,
        CancelSubscriptionDialogContent
      }
    }
  })
  return { ...result, user: userEvent.setup() }
}

function cancelStages() {
  return vi
    .mocked(useTelemetry()!.trackSubscriptionCancellation)
    .mock.calls.map(([stage]) => stage)
}

describe('CancellationFlowDialogContent', () => {
  beforeEach(() => {
    const billing = useBillingContext()
    billing.tier = computed(() => 'PRO')
    vi.mocked(useBillingContext).mockReturnValue(billing)
  })

  it('asks the survey first, with the experiment arm, then shows the offer', async () => {
    const { user } = renderFlow({
      surveyId: 'survey-1',
      flow: retentionFlow({ experiment_variant: offer.id, offer })
    })

    expect(
      screen.getByText('Survey survey-1 (save_30_next_3_v1)')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Survey continue' }))

    expect(
      screen.getByText('Offer session-1 for workspace-1')
    ).toBeInTheDocument()
  })

  it.for([
    {
      name: 'the control arm',
      flow: retentionFlow({ experiment_variant: 'control' })
    },
    { name: 'no retention session', flow: null }
  ])('goes from the survey to the confirmation for $name', async ({ flow }) => {
    const { user } = renderFlow({ surveyId: 'survey-1', flow })

    await user.click(screen.getByRole('button', { name: 'Survey continue' }))

    expect(
      screen.getByText('Confirm until 2026-11-12T00:00:00Z, opened: true')
    ).toBeInTheDocument()
  })

  it.for([
    {
      name: 'the offer',
      flow: retentionFlow({ experiment_variant: offer.id, offer }),
      shown: 'Offer session-1 for workspace-1'
    },
    {
      name: 'the confirmation',
      flow: null,
      shown: 'Confirm until 2026-11-12T00:00:00Z, opened: true'
    }
  ])('starts at $name when no survey is configured', ({ flow, shown }) => {
    renderFlow({ flow })

    expect(screen.getByText(shown)).toBeInTheDocument()
  })

  it.for([
    {
      name: 'a retention session',
      flow: retentionFlow({ experiment_variant: 'control' }),
      recorded: [[{ session_id: 'session-1', event: 'flow_opened' }]]
    },
    { name: 'no retention session', flow: null, recorded: [] }
  ])(
    'records the opened flow with the server for $name',
    ({ flow, recorded }) => {
      renderFlow({ surveyId: 'survey-1', flow })

      expect(
        vi.mocked(workspaceApi.recordRetentionFlowEvent).mock.calls
      ).toEqual(recorded)
    }
  )

  it('reports the flow as opened once, and abandoned when the plan is kept from the survey', async () => {
    const closeDialog = vi.spyOn(useDialogStore(), 'closeDialog')
    const { user, unmount } = renderFlow({ surveyId: 'survey-1' })

    await user.click(screen.getByRole('button', { name: 'Survey keep' }))
    unmount()

    expect(closeDialog).toHaveBeenCalledExactlyOnceWith({
      key: 'cancel-subscription'
    })
    expect(cancelStages()).toEqual(['flow_opened', 'abandoned'])
    expect(
      vi
        .mocked(useTelemetry()!.trackBillingEvent)
        .mock.calls.map(([event]) => [event.operation, event.stage])
    ).toEqual([
      ['cancel', 'intent'],
      ['cancel', 'abandoned']
    ])
  })

  it.for([
    { outcome: 'retained', stages: ['flow_opened'], toast: false },
    { outcome: 'pending', stages: ['flow_opened'], toast: true },
    { outcome: 'dismissed', stages: ['flow_opened', 'abandoned'], toast: false }
  ] as const)(
    'closes on a $outcome offer',
    async ({ outcome, stages, toast }) => {
      const closeDialog = vi.spyOn(useDialogStore(), 'closeDialog')
      const { user, unmount } = renderFlow({
        flow: retentionFlow({ experiment_variant: offer.id, offer })
      })

      await user.click(screen.getByRole('button', { name: outcome }))
      unmount()

      expect(closeDialog).toHaveBeenCalledOnce()
      expect(cancelStages()).toEqual(stages)
      expect(useToast().toasts.length > 0).toBe(toast)
    }
  )

  it('leaves abandonment to the confirmation once the owner continues cancelling', async () => {
    const { user, unmount } = renderFlow({
      flow: retentionFlow({ experiment_variant: offer.id, offer })
    })

    await user.click(screen.getByRole('button', { name: 'continueToCancel' }))

    expect(
      screen.getByText('Confirm until 2026-11-12T00:00:00Z, opened: true')
    ).toBeInTheDocument()

    unmount()

    expect(cancelStages()).toEqual(['flow_opened'])
  })
})

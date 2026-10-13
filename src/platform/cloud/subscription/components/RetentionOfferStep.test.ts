import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

import RetentionOfferStep from './RetentionOfferStep.vue'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

type TerminalOperation = Awaited<
  ReturnType<ReturnType<typeof useBillingOperationStore>['startOperation']>
>

function settlesAs(status: TerminalOperation['status']) {
  vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
    async (opId, type): Promise<TerminalOperation> => ({
      opId,
      type,
      status,
      errorMessage: null,
      startedAt: 0,
      operationStartedAt: 0,
      actionUrl: null,
      authenticationState: null,
      isAuthenticating: false,
      canRetryAuthentication: false,
      authenticationRequiredSeen: false,
      blockedOnCustomerSeen: false,
      workspaceId: 'workspace-1',
      autoHandleRequiresAction: false,
      phase: null,
      dismissed: false
    })
  )
}

function onPlan(tier: SubscriptionInfo['tier']) {
  const billing = useBillingContext()
  billing.tier = computed(() => tier)
  billing.subscription = computed(() => ({
    isActive: true,
    tier,
    duration: 'MONTHLY',
    planSlug: null,
    scheduledChange: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    agentHasFunds: true
  }))
  vi.mocked(useBillingContext).mockReturnValue(billing)
}

function renderOffer({
  isScopeCurrent = (): boolean => true,
  unitAmount = 10000,
  percent = 30,
  months = 3,
  periodEnd = Date.UTC(2026, 10, 12, 12) / 1000
}: {
  isScopeCurrent?: () => boolean
  unitAmount?: number
  percent?: number
  months?: number
  periodEnd?: number
} = {}) {
  const onDecide = vi.fn<(outcome: RetentionOfferOutcome) => void>()
  render(RetentionOfferStep, {
    props: {
      offer: {
        id: 'save_30_next_3_v1',
        percent_off: percent,
        duration_in_months: months
      },
      subscription: {
        currency: 'usd',
        unit_amount: unitAmount,
        quantity: 1,
        period_end: periodEnd
      },
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      isScopeCurrent,
      onDecide
    },
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
  return { onDecide, user: userEvent.setup() }
}

describe('RetentionOfferStep', () => {
  beforeEach(() => {
    onPlan('PRO')
  })

  it('shows the offer for the plan and records that it was displayed', () => {
    renderOffer()

    expect(
      screen.getByRole('heading', { name: 'Before you go' })
    ).toBeInTheDocument()
    expect(screen.getByText('Stay on Pro')).toBeInTheDocument()
    expect(screen.getByText('30% off')).toBeInTheDocument()
    expect(screen.getByText('$70')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(
      screen.getByText('30% off for 3 calendar months')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Keep your 21,100 monthly credits, custom LoRAs, and everything else in Pro.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'One-time offer for your current plan. Your discount period starts when you accept. After it ends, your plan returns to $100/mo. Changing plans may end your discount. Cancel anytime.'
      )
    ).toBeInTheDocument()
    expect(
      workspaceApi.recordRetentionFlowEvent
    ).toHaveBeenCalledExactlyOnceWith({
      session_id: 'session-1',
      event: 'offer_shown'
    })
  })

  it.for([
    {
      percent: 25,
      months: 1,
      term: '25% off for 1 calendar month',
      applied:
        'Your 25% discount is applied for 1 calendar month from acceptance.',
      period: '1-month discount',
      price: '$75.00/mo'
    },
    {
      percent: 40,
      months: 2,
      term: '40% off for 2 calendar months',
      applied:
        'Your 40% discount is applied for 2 calendar months from acceptance.',
      period: '2-month discount',
      price: '$60.00/mo'
    }
  ])(
    'uses the server terms for $percent% off for $months months',
    async ({ percent, months, term, applied, period, price }) => {
      settlesAs('succeeded')
      const { user } = renderOffer({ percent, months })
      expect(screen.getByText(term)).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: `Keep Pro and save ${percent}%` })
      )
      expect(await screen.findByText(applied)).toBeInTheDocument()
      expect(screen.getByText(period)).toBeInTheDocument()
      expect(screen.getByText(price)).toBeInTheDocument()
    }
  )

  it('leaves custom LoRAs out for a plan without them', () => {
    onPlan('STANDARD')
    renderOffer({ unitAmount: 2000 })

    expect(
      screen.getByText(
        'Keep your 4,200 monthly credits and everything else in Standard.'
      )
    ).toBeInTheDocument()
  })

  it('keeps cents in a price that is not a whole amount', () => {
    renderOffer({ unitAmount: 3499 })

    expect(screen.getByText('$24.49')).toBeInTheDocument()
    expect(screen.getByText('$34.99')).toBeInTheDocument()
  })

  it.for([
    { action: 'Continue cancelling', outcome: 'continueToCancel' },
    { action: 'Close', outcome: 'dismissed' }
  ] as const)(
    '$action before accepting decides $outcome',
    async ({ action, outcome }) => {
      const { onDecide, user } = renderOffer()

      await user.click(screen.getByRole('button', { name: action }))

      expect(onDecide).toHaveBeenCalledExactlyOnceWith(outcome)
      expect(workspaceApi.acceptRetentionOffer).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      name: 'mid-month acceptance',
      acceptedAt: '2026-10-12T12:00:00Z',
      periodEnd: Date.UTC(2026, 10, 12, 12) / 1000
    },
    {
      name: 'February 28 acceptance with May 28 expiry before the May 31 renewal',
      acceptedAt: '2027-02-28T12:00:00Z',
      periodEnd: Date.UTC(2027, 2, 31, 12) / 1000
    }
  ])(
    'confirms $name without predicting payments or expiry',
    async ({ acceptedAt, periodEnd }) => {
      vi.setSystemTime(new Date(acceptedAt))
      settlesAs('succeeded')
      const { onDecide, user } = renderOffer({ periodEnd })

      await user.click(
        screen.getByRole('button', { name: 'Keep Pro and save 30%' })
      )

      expect(
        await screen.findByRole('heading', { name: "You're staying on Pro" })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your 30% discount is applied for 3 calendar months from acceptance.'
        )
      ).toBeInTheDocument()
      expect(screen.getByText('$70.00/mo')).toBeInTheDocument()
      expect(screen.getByText('3-month discount')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your discount period started when you accepted. After it ends, your plan returns to $100.00/mo. Changing plans may end your discount. Cancel anytime.'
        )
      ).toBeInTheDocument()
      expect(
        screen.queryByText(
          /payments|renewals|Renews at|until|January|February|March|April|May|June|July|August|September|October|November|December|\$90/
        )
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Done' }))

      expect(onDecide).toHaveBeenCalledExactlyOnceWith('retained')
    }
  )

  it('offers to check again, but not to cancel, when the outcome is unconfirmed', async () => {
    settlesAs('timeout')
    const { onDecide, user } = renderOffer()

    await user.click(
      screen.getByRole('button', { name: 'Keep Pro and save 30%' })
    )
    await screen.findByRole('button', { name: 'Check again' })

    expect(
      screen.queryByRole('button', { name: 'Continue cancelling' })
    ).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Close' })[0])

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('pending')
  })

  it('lets the owner retry or continue cancelling after the discount is refused', async () => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValueOnce(
      new WorkspaceApiError('busy', 409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
    )
    const { onDecide, user } = renderOffer()

    await user.click(
      screen.getByRole('button', { name: 'Keep Pro and save 30%' })
    )
    await screen.findByRole('heading', {
      name: "We couldn't apply your discount"
    })
    expect(
      screen.getByText(
        'If this keeps happening, contact support with code DISCOUNT_NOT_APPLIED.'
      )
    ).toBeInTheDocument()

    settlesAs('succeeded')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: "You're staying on Pro" })
    ).toBeInTheDocument()
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledTimes(2)
    expect(onDecide).not.toHaveBeenCalled()
  })

  it('continues cancelling after the discount is refused', async () => {
    vi.mocked(workspaceApi.acceptRetentionOffer).mockRejectedValueOnce(
      new WorkspaceApiError('busy', 409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
    )
    const { onDecide, user } = renderOffer()

    await user.click(
      screen.getByRole('button', { name: 'Keep Pro and save 30%' })
    )
    await screen.findByRole('button', { name: 'Try again' })
    await user.click(
      screen.getByRole('button', { name: 'Continue cancelling' })
    )

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('continueToCancel')
  })

  it.for([
    {
      name: 'the discount is declined',
      refuse: () => settlesAs('failed'),
      heading: "We couldn't apply your discount"
    },
    {
      name: 'the session expired',
      refuse: () =>
        vi
          .mocked(workspaceApi.acceptRetentionOffer)
          .mockRejectedValue(
            new WorkspaceApiError('stale', 409, 'RETENTION_SESSION_STALE')
          ),
      heading: 'This offer is no longer available'
    }
  ])('offers no retry when $name', async ({ refuse, heading }) => {
    refuse()
    const { onDecide, user } = renderOffer()

    await user.click(
      screen.getByRole('button', { name: 'Keep Pro and save 30%' })
    )
    await screen.findByRole('heading', { name: heading })

    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Continue cancelling' })
    )
    await user.click(screen.getByRole('button', { name: 'Keep my plan' }))

    expect(onDecide.mock.calls).toEqual([['continueToCancel'], ['dismissed']])
    expect(workspaceApi.acceptRetentionOffer).toHaveBeenCalledOnce()
  })

  it('withdraws an offer whose session expired before it was shown', async () => {
    vi.mocked(workspaceApi.recordRetentionFlowEvent).mockRejectedValue(
      new WorkspaceApiError('stale', 409, 'RETENTION_SESSION_STALE')
    )
    renderOffer()

    expect(
      await screen.findByRole('heading', {
        name: 'This offer is no longer available'
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Keep Pro and save 30%' })
    ).not.toBeInTheDocument()
  })

  it('does not redeem after the active workspace changed', async () => {
    const { onDecide, user } = renderOffer({ isScopeCurrent: () => false })

    await user.click(
      screen.getByRole('button', { name: 'Keep Pro and save 30%' })
    )

    expect(workspaceApi.acceptRetentionOffer).not.toHaveBeenCalled()
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({ kind: 'warning' })
    )
    expect(onDecide).toHaveBeenCalledExactlyOnceWith('dismissed')
  })
})

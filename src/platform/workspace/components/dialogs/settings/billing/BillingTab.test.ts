import type {
  BillingOpReceiptPlan,
  BillingOpStatusResponse,
  BillingStatusResponse,
  SubscriptionState
} from '@comfyorg/ingest-types'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useTelemetry } from '@/platform/telemetry'
import type {
  HostedTopupCheckout,
  Plan
} from '@/platform/workspace/api/workspaceApi'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { reportError } from '@/platform/telemetry/reportError'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { usePausedBanner } from '@/platform/workspace/composables/usePausedBanner'

import BillingTab from './BillingTab.vue'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get DISTRIBUTION() {
    return distribution.isCloud ? 'cloud' : 'localhost'
  },
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return false
  },
  get isNightly() {
    return false
  }
}))
vi.mock(import('@/platform/workspace/composables/usePausedBanner'), {
  spy: true
})
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/billing/useBillingDialogs'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/cloud/subscription/composables/useFreeTierQuota'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}?workspace=ws_1`
}))

const activeSubscription: SubscriptionInfo = {
  isActive: true,
  tier: 'PRO',
  duration: 'MONTHLY',
  planSlug: 'pro-monthly',
  scheduledChange: null,
  renewalDate: '2026-11-15T00:00:00Z',
  endDate: null,
  isCancelled: false,
  hasFunds: true,
  agentHasFunds: true
}

interface Scenario {
  subscription?: SubscriptionInfo | null
  subscriptionStatus?: 'active' | 'canceled' | 'ended' | null
  subscriptionState?: SubscriptionState | null
  isInitialized?: boolean
  error?: string | null
  canManageSubscription?: boolean
  canManageBilling?: boolean
  canSubscribeSelfServe?: boolean
  canRevertScheduledChange?: boolean
  canReactivate?: boolean
  resubscribe?: () => Promise<void>
  capabilitiesReady?: boolean
  capabilitiesResolved?: boolean
  balance?: BalanceInfo | null
  autoTopUpFlag?: boolean
  canManageAutoTopUp?: boolean
  canTopUp?: boolean
  isPaused?: boolean
}

function arrange(scenario: Scenario = {}) {
  const initialize = vi.fn(async () => {})
  const refresh = vi.fn(async () => {})
  const fetchStatus = vi.fn(async () => {})
  const resubscribe = vi.fn(scenario.resubscribe ?? (async () => {}))
  const manageSubscription = vi.fn(async () => ({ ok: true as const }))
  vi.mocked(usePausedBanner).mockReturnValue({
    isPaused: computed(() => scenario.isPaused ?? false)
  })

  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      isInitialized: ref(scenario.isInitialized ?? true),
      isLoading: ref(false),
      error: ref(scenario.error ?? null),
      subscription: computed(() =>
        scenario.subscription === undefined
          ? activeSubscription
          : scenario.subscription
      ),
      subscriptionStatus: computed(() =>
        scenario.subscriptionStatus === undefined
          ? 'active'
          : scenario.subscriptionStatus
      ),
      subscriptionState: computed(() => scenario.subscriptionState ?? null),
      billingStatus: computed(() => 'paid'),
      manageSubscription,
      isTeamPlan: computed(() => false),
      plans: computed(() => [
        fromPartial<Plan>({ slug: 'creator-yearly', tier: 'CREATOR' })
      ]),
      balance: computed(() => scenario.balance ?? null),
      currentTeamCreditStop: computed(() => null),
      initialize,
      fetchStatus,
      resubscribe
    })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({
      canSubscribeSelfServe: computed(
        () => scenario.canSubscribeSelfServe ?? true
      ),
      canRevertScheduledChange: computed(
        () => scenario.canRevertScheduledChange ?? false
      ),
      canReactivate: computed(() => scenario.canReactivate ?? false),
      canManageSubscription: computed(() =>
        receiveServerFact(
          'can_manage_subscription',
          scenario.canManageSubscription ?? true
        )
      ),
      canManageBilling: computed(() =>
        receiveServerFact(
          'can_manage_billing',
          scenario.canManageBilling ?? true
        )
      ),
      canTopUp: computed(() => scenario.canTopUp ?? true),
      canManageAutoTopUp: computed(() =>
        receiveServerFact(
          'can_manage_auto_top_up',
          scenario.canManageAutoTopUp ?? true
        )
      ),
      autoTopUpSetup: computed(() => null),
      isReady: computed(() => scenario.capabilitiesReady ?? true),
      hasResolvedCapabilities: computed(
        () => scenario.capabilitiesResolved ?? true
      ),
      initialize: vi.fn(async () => {}),
      refresh
    })
  )
  vi.mocked(useFeatureFlags().flags).autoTopUpEnabled =
    scenario.autoTopUpFlag ?? true
  vi.mocked(useFreeTierQuota).mockReturnValue(
    fromPartial({
      quotaEnabled: computed(() => false),
      available: ref(0),
      maxAvailable: ref(0)
    })
  )

  render(BillingTab, {
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

  return { initialize, refresh, fetchStatus, resubscribe, manageSubscription }
}

describe('BillingTab', () => {
  describe('Subscription paused banner', () => {
    it.for([
      {
        name: 'an owner',
        canManageBilling: true,
        body: "This workspace's subscription is paused. Update payment to resume.",
        buttons: ['Update payment']
      },
      {
        name: 'a member',
        canManageBilling: false,
        body: "Ask your workspace owner to restore the workspace's subscription.",
        buttons: []
      }
    ])(
      'shows $name the paused banner at the top of the tab',
      ({ canManageBilling, body, buttons }) => {
        arrange({ isPaused: true, canManageBilling })

        const banner = screen.getByTestId('billing-paused-banner')
        expect(banner).toHaveTextContent('Subscription paused')
        expect(banner).toHaveTextContent(body)
        expect(
          within(banner)
            .queryAllByRole('button')
            .map((button) => button.textContent.trim())
        ).toEqual(buttons)
      }
    )

    it('opens the billing portal from Update payment', async () => {
      const { manageSubscription } = arrange({ isPaused: true })

      await userEvent.click(
        within(screen.getByTestId('billing-paused-banner')).getByRole(
          'button',
          { name: 'Update payment' }
        )
      )

      expect(manageSubscription).toHaveBeenCalledOnce()
    })

    it('shows no paused banner when the workspace is not paused', () => {
      arrange()

      expect(
        screen.queryByTestId('billing-paused-banner')
      ).not.toBeInTheDocument()
    })
  })

  it('shows a skeleton and no plan row while billing loads', () => {
    arrange({ isInitialized: false })

    expect(screen.getByTestId('billing-plan-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('billing-plan-row')).not.toBeInTheDocument()
  })

  it('replaces the plan with one error that retries both reads', async () => {
    const { initialize, refresh } = arrange({ error: 'boom' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your plan."
    )
    expect(screen.queryByTestId('billing-plan-row')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(initialize).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the error when capabilities settle without a snapshot', () => {
    arrange({ capabilitiesResolved: false })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('reads Activating while subscription_state is activating', () => {
    arrange({ subscriptionState: 'activating' })

    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Activating your Pro plan…'
    )
    expect(screen.getByRole('link', { name: 'Manage' })).toBeInTheDocument()
  })

  it('returns to the served status when subscription_state is no longer activating', () => {
    arrange({ subscriptionState: 'active' })

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Billed monthly. Next invoice November 15.'
    )
    expect(screen.queryByText(/Activating your/)).not.toBeInTheDocument()
  })

  it('renders an active plan with Manage and the owner handoff linked to the billing site', () => {
    arrange()

    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Billed monthly. Next invoice November 15.'
    )
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/billing/plans?workspace=ws_1'
    )
    expect(screen.getByRole('link', { name: 'Open billing' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/billing?workspace=ws_1'
    )
  })

  it('hides the plan action when the server does not grant it', () => {
    arrange({ canSubscribeSelfServe: false })

    expect(
      screen.queryByRole('link', { name: 'Manage' })
    ).not.toBeInTheDocument()
  })

  it('gives a member usage instead of billing and no plan action', () => {
    arrange({
      canManageSubscription: false,
      canManageBilling: false,
      canSubscribeSelfServe: false
    })

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Managed by the workspace owner.'
    )
    expect(screen.getByRole('link', { name: 'View usage' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/usage?workspace=ws_1'
    )
    expect(
      screen.queryByRole('link', { name: 'Open billing' })
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      canManageSubscription: true,
      line: 'Billed monthly. Next invoice November 15.'
    },
    {
      canManageSubscription: false,
      line: 'Billed monthly. Next invoice November 15. Managed by the workspace owner.'
    }
  ])(
    'renders the plan line from can_manage_subscription $canManageSubscription',
    ({ canManageSubscription, line }) => {
      arrange({ canManageSubscription, canManageBilling: true })

      expect(screen.getByTestId('billing-plan-line').textContent.trim()).toBe(
        line
      )
    }
  )

  it.for([
    { canManageBilling: true, link: 'Open billing', path: '/profile/billing' },
    { canManageBilling: false, link: 'View usage', path: '/profile/usage' }
  ])(
    'hands off to $link when can_manage_billing is $canManageBilling',
    ({ canManageBilling, link, path }) => {
      arrange({ canManageSubscription: true, canManageBilling })

      expect(screen.getByRole('link', { name: link })).toHaveAttribute(
        'href',
        `https://platform.test${path}?workspace=ws_1`
      )
    }
  )

  describe('Stay on plan', () => {
    const scheduledChange: SubscriptionInfo = {
      ...activeSubscription,
      scheduledChange: {
        plan_slug: 'creator-yearly',
        effective_at: '2026-10-28T00:00:00Z',
        team_credit_stop: null
      }
    }

    async function openStay(scenario: Scenario = {}) {
      const arranged = arrange({
        subscription: scheduledChange,
        canRevertScheduledChange: true,
        ...scenario
      })
      await userEvent.click(screen.getByRole('button', { name: 'Stay on Pro' }))
      return arranged
    }

    it('confirms with the target and date the scheduled change carries, and no amount', async () => {
      await openStay()

      const dialog = screen.getByRole('dialog', {
        name: 'Cancel your change to Creator?'
      })
      expect(dialog).toHaveTextContent(
        "Your plan won't change to Creator on October 28, 2026. You can schedule a change again anytime."
      )
      expect(dialog).not.toHaveTextContent('$')
    })

    it('reverts the scheduled change and rereads status when confirmed', async () => {
      const { fetchStatus, refresh } = await openStay()
      fetchStatus.mockClear()

      await userEvent.click(screen.getByRole('button', { name: 'Stay on Pro' }))

      expect(workspaceApi.revertScheduledChange).toHaveBeenCalledOnce()
      expect(fetchStatus).toHaveBeenCalled()
      expect(refresh).toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    describe('when the server accepts the revert as pending', () => {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        vi.mocked(workspaceApi.revertScheduledChange).mockResolvedValueOnce({
          billing_op_id: 'op-revert',
          status: 'pending'
        })
      })

      async function confirmStay() {
        const user = userEvent.setup({
          advanceTimers: vi.advanceTimersByTime
        })
        await user.click(screen.getByRole('button', { name: 'Stay on Pro' }))
      }

      it('waits for the operation to succeed before rereading status and closing', async () => {
        vi.mocked(workspaceApi.getBillingOpStatus)
          .mockResolvedValueOnce({
            id: 'op-revert',
            started_at: '2026-10-17T00:00:00Z',
            status: 'pending'
          })
          .mockResolvedValueOnce({
            id: 'op-revert',
            started_at: '2026-10-17T00:00:00Z',
            status: 'succeeded'
          })
        const { fetchStatus } = await openStay()
        fetchStatus.mockClear()

        await confirmStay()
        await vi.advanceTimersByTimeAsync(1500)

        expect(fetchStatus).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        await vi.advanceTimersByTimeAsync(1500)

        expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledWith(
          'op-revert'
        )
        expect(fetchStatus).toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      const pollRejection = new WorkspaceApiError('Gateway timeout', 504)

      it.for([
        {
          outcome: 'the operation fails',
          arrangePoll: () =>
            vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValueOnce({
              id: 'op-revert',
              started_at: '2026-10-17T00:00:00Z',
              status: 'failed',
              error_message: 'Stripe rejected the update'
            }),
          reported: 'Stripe rejected the update'
        },
        {
          outcome: 'the status read fails',
          arrangePoll: () =>
            vi
              .mocked(workspaceApi.getBillingOpStatus)
              .mockRejectedValueOnce(pollRejection),
          reported: pollRejection
        }
      ])(
        'keeps the dialog open with generic copy and rereads status when $outcome',
        async ({ arrangePoll, reported }) => {
          arrangePoll()
          const { fetchStatus } = await openStay()
          fetchStatus.mockClear()

          await confirmStay()
          await vi.advanceTimersByTimeAsync(1500)

          expect(screen.getByRole('alert')).toHaveTextContent(
            "We couldn't make this change. Try again."
          )
          expect(screen.getByRole('dialog')).toBeInTheDocument()
          expect(fetchStatus).toHaveBeenCalled()
          expect(reportError).toHaveBeenCalledWith(
            reported,
            expect.objectContaining({
              errorType: 'failure_reverting_scheduled_plan_change'
            })
          )
        }
      )
    })

    it('shows the server message when the server refuses', async () => {
      vi.mocked(workspaceApi.revertScheduledChange).mockRejectedValueOnce(
        new WorkspaceApiError(
          'Only the original owner can change this plan.',
          403,
          'NOT_ORIGINAL_OWNER'
        )
      )
      const { fetchStatus } = await openStay()
      fetchStatus.mockClear()

      await userEvent.click(screen.getByRole('button', { name: 'Stay on Pro' }))

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Only the original owner can change this plan.'
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(fetchStatus).not.toHaveBeenCalled()
      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports an uncoded failure and shows generic copy', async () => {
      vi.mocked(workspaceApi.revertScheduledChange).mockRejectedValueOnce(
        new Error('Network Error')
      )
      await openStay()

      await userEvent.click(screen.getByRole('button', { name: 'Stay on Pro' }))

      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't make this change. Try again."
      )
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_reverting_scheduled_plan_change'
        })
      )
    })

    it('hides Stay when the server withholds can_revert_scheduled_change', () => {
      arrange({
        subscription: scheduledChange,
        canRevertScheduledChange: false
      })

      expect(
        screen.queryByRole('button', { name: 'Stay on Pro' })
      ).not.toBeInTheDocument()
    })
  })

  describe('Resume plan', () => {
    const ending: Scenario = {
      subscription: {
        ...activeSubscription,
        isCancelled: true,
        endDate: '2026-10-28T00:00:00Z'
      },
      subscriptionStatus: 'canceled',
      canReactivate: true
    }

    async function openResume(scenario: Scenario = {}) {
      const arranged = arrange({ ...ending, ...scenario })
      await userEvent.click(screen.getByRole('button', { name: 'Resume plan' }))
      return arranged
    }

    it('confirms renewal on the date the plan ends, and no amount', async () => {
      await openResume()

      const dialog = screen.getByRole('dialog', {
        name: 'Resume your Pro plan?'
      })
      expect(dialog).toHaveTextContent(
        'Your plan will renew on October 28, 2026. You can cancel again anytime.'
      )
      expect(dialog).not.toHaveTextContent('$')
    })

    it('resumes the plan and closes when confirmed', async () => {
      const { resubscribe } = await openResume()

      await userEvent.click(screen.getByRole('button', { name: 'Resume plan' }))

      expect(resubscribe).toHaveBeenCalledOnce()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows the server message when the server refuses', async () => {
      await openResume({
        resubscribe: async () => {
          throw new WorkspaceApiError(
            'Only the original owner can resume this plan.',
            403,
            'NOT_ORIGINAL_OWNER'
          )
        }
      })

      await userEvent.click(screen.getByRole('button', { name: 'Resume plan' }))

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Only the original owner can resume this plan.'
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('hides Resume when the server withholds can_reactivate', () => {
      arrange({ ...ending, canReactivate: false })

      expect(
        screen.queryByRole('button', { name: 'Resume plan' })
      ).not.toBeInTheDocument()
    })
  })

  it('renders an unrecognised plan as Your plan', () => {
    arrange({ subscription: { ...activeSubscription, tier: null } })

    expect(
      screen.getByRole('heading', { name: 'Your plan' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('billing-plan-line')).not.toBeInTheDocument()
  })

  it('shows the served balance under the plan and opens top-up from Add credits', async () => {
    const trackAddApiCreditButtonClicked = vi.fn()
    vi.mocked(useTelemetry).mockReturnValueOnce(
      fromPartial({ trackAddApiCreditButtonClicked })
    )
    arrange({
      balance: {
        amountMicros: 1000,
        currency: 'usd',
        effectiveBalanceMicros: 1000,
        effectiveBalanceAuthoritative: true,
        prepaidBalanceMicros: 1000,
        cloudCreditBalanceMicros: 0
      }
    })

    expect(screen.getByTestId('billing-credits-available')).toHaveTextContent(
      '2,110'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

    expect(trackAddApiCreditButtonClicked).toHaveBeenCalledExactlyOnceWith({
      source: 'credits_panel'
    })
    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      source: 'settings_billing_panel'
    })
  })

  describe('Top-up checkout banner', () => {
    function servedCheckouts(...checkouts: HostedTopupCheckout[]) {
      vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
        checkouts: checkouts.map(({ session_id, amount_cents }) => ({
          session_id,
          amount_cents,
          created_at: '2026-10-20T00:00:00Z'
        })),
        next_cursor: null
      })
      vi.mocked(workspaceApi.getTopupCheckout).mockImplementation(
        async (sessionId) => {
          const served = checkouts.find(
            ({ session_id }) => session_id === sessionId
          )
          if (!served) throw new WorkspaceApiError('Not found', 404)
          return served
        }
      )
    }

    function checkout(
      state: HostedTopupCheckout['state'],
      overrides: Partial<HostedTopupCheckout> = {}
    ): HostedTopupCheckout {
      return {
        session_id: `cs_${state}`,
        amount_cents: 2500,
        payment_amount_cents: 2500,
        state,
        ...overrides
      }
    }

    it.for([
      {
        state: 'payment_processing',
        text: "Payment processingYour bank is confirming the payment. Credits are added once it clears, so you don't need to pay again."
      },
      {
        state: 'credits_applying',
        text: "Payment receivedYour credits are being added. You won't be charged again."
      }
    ] as const)(
      'renders a $state checkout as received, with only Dismiss',
      async ({ state, text }) => {
        servedCheckouts(checkout(state))
        arrange()

        const banner = await screen.findByTestId('billing-checkout-banner')
        expect(banner).toHaveTextContent(text)
        expect(
          within(banner)
            .getAllByRole('button')
            .map((button) => button.textContent.trim())
        ).toEqual(['Dismiss'])
      }
    )

    it.for([
      { paymentAmountCents: 2500, title: "Your $25 top-up didn't go through" },
      { paymentAmountCents: null, title: "Your top-up didn't go through" }
    ])(
      'titles a failed top-up "$title" from payment_amount_cents $paymentAmountCents and offers Add credits',
      async ({ paymentAmountCents, title }) => {
        servedCheckouts(
          checkout('failed', { payment_amount_cents: paymentAmountCents })
        )
        const trackAddApiCreditButtonClicked = vi.fn()
        vi.mocked(useTelemetry).mockReturnValueOnce(
          fromPartial({ trackAddApiCreditButtonClicked })
        )
        arrange()

        const banner = await screen.findByTestId('billing-checkout-banner')
        expect(banner).toHaveTextContent(title)
        expect(banner).toHaveTextContent(
          'No credits were added. Try again or use a different payment method.'
        )
        await userEvent.click(
          within(banner).getByRole('button', { name: 'Add credits' })
        )
        expect(trackAddApiCreditButtonClicked).toHaveBeenCalledExactlyOnceWith({
          source: 'settings_billing_panel'
        })
        expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith(
          { source: 'settings_billing_panel' }
        )
      }
    )

    const zeroBalance: BalanceInfo = {
      amountMicros: 0,
      currency: 'usd',
      effectiveBalanceMicros: 0,
      effectiveBalanceAuthoritative: true,
      prepaidBalanceMicros: 0,
      cloudCreditBalanceMicros: 0
    }

    it('turns both Add credits buttons white when Available is 0 and the top-up failed', async () => {
      servedCheckouts(checkout('failed'))
      arrange({ balance: zeroBalance })

      const banner = await screen.findByTestId('billing-checkout-banner')
      expect(
        [
          within(banner).getByRole('button', { name: 'Add credits' }),
          within(screen.getByTestId('billing-credits-card')).getByRole(
            'button',
            { name: 'Add credits' }
          )
        ].map((button) => button.getAttribute('data-variant'))
      ).toEqual(['inverted', 'inverted'])
    })

    it('keeps Add credits grey at 0 while the payment is processing', async () => {
      servedCheckouts(checkout('payment_processing'))
      arrange({ balance: zeroBalance })

      await screen.findByTestId('billing-checkout-banner')
      expect(
        within(screen.getByTestId('billing-credits-card')).getByRole('button', {
          name: 'Add credits'
        })
      ).toHaveAttribute('data-variant', 'secondary')
    })

    it('offers no Add credits on a failed top-up when the server withholds can_top_up', async () => {
      servedCheckouts(checkout('failed'))
      arrange({ canTopUp: false })

      const banner = await screen.findByTestId('billing-checkout-banner')
      expect(
        within(banner).queryByRole('button', { name: 'Add credits' })
      ).not.toBeInTheDocument()
    })

    it('reveals the processing payment once the failed top-up is dismissed', async () => {
      servedCheckouts(checkout('failed'), checkout('payment_processing'))
      arrange()

      const banner = await screen.findByTestId('billing-checkout-banner')
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Dismiss' })
      )

      expect(screen.getByTestId('billing-checkout-banner')).toHaveTextContent(
        'Payment processing'
      )
    })

    it('clears the credits banner on its own once the server reports fulfilled', async () => {
      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      arrange()
      await screen.findByTestId('billing-checkout-banner')

      servedCheckouts(checkout('fulfilled', { session_id: 'cs_1' }))
      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(
          screen.queryByTestId('billing-checkout-banner')
        ).not.toBeInTheDocument()
      )
    })

    it('keeps other checkouts visible when one session read fails', async () => {
      const unavailable = new WorkspaceApiError('Bad gateway', 502)
      vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_unreadable',
            amount_cents: 500,
            created_at: '2026-10-20T00:00:00Z'
          },
          {
            session_id: 'cs_payment_processing',
            amount_cents: 2500,
            created_at: '2026-10-19T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      vi.mocked(workspaceApi.getTopupCheckout).mockImplementation(
        async (sessionId) => {
          if (sessionId === 'cs_unreadable') throw unavailable
          return checkout('payment_processing')
        }
      )
      arrange()

      expect(
        await screen.findByTestId('billing-checkout-banner')
      ).toHaveTextContent('Payment processing')
      expect(reportError).toHaveBeenCalledWith(
        unavailable,
        expect.objectContaining({ errorType: 'topup_checkout_read_failed' })
      )
    })

    it('reports a failed checkout list and shows no banner', async () => {
      const unavailable = new WorkspaceApiError('Unavailable', 503)
      vi.mocked(workspaceApi.listTopupCheckouts).mockRejectedValue(unavailable)
      arrange()

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          unavailable,
          expect.objectContaining({ errorType: 'topup_checkout_read_failed' })
        )
      )
      expect(
        screen.queryByTestId('billing-checkout-banner')
      ).not.toBeInTheDocument()
    })

    it('keeps polling credits_applying after a newer failure takes the banner', async () => {
      servedCheckouts(
        checkout('failed', { session_id: 'cs_failed' }),
        checkout('credits_applying', { session_id: 'cs_applying' })
      )
      arrange()

      expect(
        await screen.findByTestId('billing-checkout-banner')
      ).toHaveTextContent("Your $25 top-up didn't go through")
      vi.mocked(workspaceApi.getTopupCheckout).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith(
          'cs_applying'
        )
      )
    })

    it('reports one unreadable session once while credits are still applying', async () => {
      const unavailable = new WorkspaceApiError('Bad gateway', 502)
      vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_unreadable',
            amount_cents: 500,
            created_at: '2026-10-20T00:00:00Z'
          },
          {
            session_id: 'cs_applying',
            amount_cents: 2500,
            created_at: '2026-10-19T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      vi.mocked(workspaceApi.getTopupCheckout).mockImplementation(
        async (sessionId) => {
          if (sessionId === 'cs_unreadable') throw unavailable
          return checkout('credits_applying', { session_id: 'cs_applying' })
        }
      )
      arrange()

      await screen.findByTestId('billing-checkout-banner')
      expect(reportError).toHaveBeenCalledTimes(1)
      vi.mocked(reportError).mockClear()
      vi.mocked(workspaceApi.getTopupCheckout).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith(
          'cs_unreadable'
        )
      )
      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports a checkout list failure once until a later read succeeds', async () => {
      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      arrange()
      await screen.findByTestId('billing-checkout-banner')

      const unavailable = new WorkspaceApiError('Unavailable', 503)
      vi.mocked(workspaceApi.listTopupCheckouts).mockRejectedValue(unavailable)
      vi.mocked(reportError).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(5_000)
      expect(reportError).toHaveBeenCalledTimes(1)

      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      vi.mocked(workspaceApi.getTopupCheckout).mockClear()
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() =>
        expect(workspaceApi.getTopupCheckout).toHaveBeenCalled()
      )

      vi.mocked(workspaceApi.listTopupCheckouts).mockRejectedValue(unavailable)
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(2))
    })

    it('never reads checkouts for a member without can_manage_billing', () => {
      servedCheckouts(checkout('payment_processing'))
      arrange({ canManageBilling: false })

      expect(workspaceApi.listTopupCheckouts).not.toHaveBeenCalled()
      expect(
        screen.queryByTestId('billing-checkout-banner')
      ).not.toBeInTheDocument()
    })
  })

  describe('Plan checkout banner', () => {
    const creatorPlan: BillingOpReceiptPlan = {
      slug: 'creator-monthly',
      duration: 'MONTHLY',
      tier: 'CREATOR'
    }

    function servedOperation(overrides: Partial<BillingOpStatusResponse>) {
      const operation: BillingOpStatusResponse = {
        id: 'op-parked',
        started_at: '2026-10-20T00:00:00Z',
        status: 'pending',
        plan: creatorPlan,
        ...overrides
      }
      vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue(
        fromPartial<BillingStatusResponse>({
          pending_billing_op_id: operation.id,
          pending_billing_op_type: 'subscription'
        })
      )
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(operation)
      return operation
    }

    const parked = { phase: 'awaiting_payment_method' } as const

    function reservedTab() {
      const tab = fromPartial<Window>({
        location: fromPartial<Location>({ href: '' }),
        close: vi.fn()
      })
      vi.spyOn(window, 'open').mockReturnValue(tab)
      return tab
    }

    it.for([
      {
        served: parked,
        text: 'You have an unfinished checkoutFinish paying for your Creator plan.',
        action: 'Continue payment'
      },
      {
        served: { phase: 'in_progress', authentication_state: 'processing' },
        text: 'Payment processingYour bank is confirming the payment. Your Creator plan starts once it clears.',
        action: null
      },
      {
        served: {
          status: 'failed',
          decline_reason: 'card_declined',
          retryable: true
        },
        text: "Your Creator plan didn't startThe payment didn't go through. Try again or use a different payment method.",
        action: 'Try again'
      }
    ] as const)(
      'renders "$text" from the served operation',
      async ({ served, text, action }) => {
        servedOperation(served)
        arrange()

        const banner = await screen.findByTestId('billing-checkout-banner')
        expect(banner).toHaveTextContent(text)
        expect(
          within(banner)
            .getAllByRole('button')
            .map((button) => button.textContent.trim())
        ).toEqual(action ? ['Dismiss', action] : ['Dismiss'])
      }
    )

    it('hides a plan checkout on local and keeps a top-up banner', async () => {
      distribution.isCloud = false
      try {
        servedOperation(parked)
        vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
          checkouts: [
            {
              session_id: 'cs_bank',
              amount_cents: 2500,
              created_at: '2026-10-20T00:00:00Z'
            }
          ],
          next_cursor: null
        })
        vi.mocked(workspaceApi.getTopupCheckout).mockResolvedValue({
          session_id: 'cs_bank',
          amount_cents: 2500,
          payment_amount_cents: 2500,
          state: 'payment_processing'
        })
        arrange()

        const banner = await screen.findByTestId('billing-checkout-banner')
        expect(banner).toHaveTextContent('Payment processing')
        expect(banner).not.toHaveTextContent('unfinished checkout')
        expect(workspaceApi.getBillingOpStatus).not.toHaveBeenCalled()
      } finally {
        distribution.isCloud = true
      }
    })

    it('reopens the parked checkout in a reserved tab', async () => {
      servedOperation(parked)
      const tab = reservedTab()
      vi.mocked(workspaceApi.subscribe).mockResolvedValue({
        billing_op_id: 'op-parked',
        status: 'needs_payment_method',
        payment_method_url: 'https://checkout.stripe.test/fresh'
      })
      const { fetchStatus } = arrange()

      const banner = await screen.findByTestId('billing-checkout-banner')
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Continue payment' })
      )

      expect(workspaceApi.subscribe).toHaveBeenCalledWith(
        'creator-monthly',
        expect.objectContaining({ teamCreditStopId: undefined })
      )
      await vi.waitFor(() =>
        expect(tab.location.href).toBe('https://checkout.stripe.test/fresh')
      )
      expect(fetchStatus).toHaveBeenCalled()
    })

    it('turns Continue payment into a real link to the fresh session when the tab is blocked', async () => {
      servedOperation(parked)
      vi.spyOn(window, 'open').mockReturnValue(null)
      vi.mocked(workspaceApi.subscribe).mockResolvedValue({
        billing_op_id: 'op-parked',
        status: 'needs_payment_method',
        payment_method_url: 'https://checkout.stripe.test/fresh'
      })
      arrange()

      const banner = await screen.findByTestId('billing-checkout-banner')
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Continue payment' })
      )

      const link = await within(banner).findByRole('link', {
        name: 'Continue payment'
      })
      expect(link).toHaveAttribute('href', 'https://checkout.stripe.test/fresh')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
      expect(workspaceApi.subscribe).toHaveBeenCalledOnce()
    })

    it('says checkout did not open when the resubmit is refused', async () => {
      servedOperation(parked)
      const tab = reservedTab()
      const refused = new WorkspaceApiError('Busy', 409)
      vi.mocked(workspaceApi.subscribe).mockRejectedValue(refused)
      arrange()

      const banner = await screen.findByTestId('billing-checkout-banner')
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Continue payment' })
      )

      expect(await within(banner).findByRole('alert')).toHaveTextContent(
        "We couldn't open checkout. Try again."
      )
      expect(tab.close).toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledWith(
        refused,
        expect.objectContaining({
          errorType: 'subscription_checkout_reopen_failed'
        })
      )
    })

    it('offers no checkout action when the server withholds can_subscribe_self_serve', async () => {
      servedOperation(parked)
      arrange({ canSubscribeSelfServe: false })

      const banner = await screen.findByTestId('billing-checkout-banner')
      expect(
        within(banner).queryByRole('button', { name: 'Continue payment' })
      ).not.toBeInTheDocument()
    })

    it('shows a credits payment in flight above an unfinished plan checkout', async () => {
      servedOperation(parked)
      vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_bank',
            amount_cents: 2500,
            created_at: '2026-10-20T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      vi.mocked(workspaceApi.getTopupCheckout).mockResolvedValue({
        session_id: 'cs_bank',
        amount_cents: 2500,
        payment_amount_cents: 2500,
        state: 'payment_processing'
      })
      arrange()

      await vi.waitFor(() =>
        expect(screen.getByTestId('billing-checkout-banner')).toHaveTextContent(
          'Credits are added once it clears'
        )
      )
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.getByTestId('billing-checkout-banner')).toHaveTextContent(
        'You have an unfinished checkout'
      )
    })

    it('shows the failure of an operation it watched once status stops listing it', async () => {
      servedOperation(parked)
      arrange()
      await screen.findByText('You have an unfinished checkout')

      vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue(
        fromPartial<BillingStatusResponse>({})
      )
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-parked',
        started_at: '2026-10-20T00:00:00Z',
        status: 'failed',
        decline_reason: 'insufficient_funds',
        plan: creatorPlan
      })
      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      visibility.mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      visibility.mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))

      expect(
        await screen.findByText("Your Creator plan didn't start")
      ).toBeInTheDocument()
      expect(workspaceApi.getBillingOpStatus).toHaveBeenLastCalledWith(
        'op-parked'
      )
    })

    it('hides the failed plan after Subscribe succeeds and status lists no operation', async () => {
      servedOperation({
        status: 'failed',
        decline_reason: 'card_declined',
        retryable: true
      })
      reservedTab()
      arrange()
      const banner = await screen.findByTestId('billing-checkout-banner')
      expect(banner).toHaveTextContent("Your Creator plan didn't start")

      vi.mocked(workspaceApi.subscribe).mockResolvedValue({
        status: 'subscribed',
        billing_op_id: 'op-new'
      })
      vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue(
        fromPartial<BillingStatusResponse>({})
      )
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Try again' })
      )

      await vi.waitFor(() =>
        expect(
          screen.queryByText("Your Creator plan didn't start")
        ).not.toBeInTheDocument()
      )

      const reads = vi.mocked(workspaceApi.getBillingStatus).mock.calls.length
      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      visibility.mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      visibility.mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.waitFor(() =>
        expect(
          vi.mocked(workspaceApi.getBillingStatus).mock.calls.length
        ).toBeGreaterThan(reads)
      )
      expect(
        screen.queryByText("Your Creator plan didn't start")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('billing-checkout-banner')?.textContent ?? ''
      ).not.toContain('Try again')
    })
  })

  describe('Auto top-up card', () => {
    it('shows the card when the flag is on and the server grants both facts', async () => {
      arrange()

      expect(
        await screen.findByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('Off')
    })

    it.for<{ case: string; scenario: Scenario }>([
      { case: 'the flag is off', scenario: { autoTopUpFlag: false } },
      {
        case: 'a member without can_manage_auto_top_up',
        scenario: { canManageAutoTopUp: false }
      },
      {
        case: 'top-up is paused (can_top_up false)',
        scenario: { canTopUp: false }
      }
    ])('hides the card when $case', ({ scenario }) => {
      arrange(scenario)

      expect(
        screen.queryByTestId('billing-auto-top-up-card')
      ).not.toBeInTheDocument()
      expect(workspaceApi.getBillingAutoReload).not.toHaveBeenCalled()
    })
  })
})

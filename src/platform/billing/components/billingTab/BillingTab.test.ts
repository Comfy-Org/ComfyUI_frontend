import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionState } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useSubscriptionPaywall } from '@/platform/billing/composables/useSubscriptionPaywall'
import type {
  BalanceInfo,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { activateBillingScope } from '@/platform/billing/composables/activateBillingScope.testUtils'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'

import BillingTab from './BillingTab.vue'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/billing/composables/usePausedBanner'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/useSubscriptionPaywall'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/billing/subscription/composables/useFreeTierQuota'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?workspace=ws_1&correlation_id=${correlationId}`
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
  canOpenPlans?: boolean
  canRevertScheduledChange?: boolean
  canReactivate?: boolean
  resubscribe?: () => Promise<void>
  capabilitiesReady?: boolean
  capabilitiesResolved?: boolean
  balance?: BalanceInfo | null
  autoTopUpFlag?: boolean
  canManageAutoTopUp?: boolean
  canTopUp?: boolean
  topUpDenial?: string
  isPaused?: boolean
  hasParkedBillingOperation?: boolean
}

function correlationIdOf(link: HTMLElement) {
  return new URL(link.getAttribute('href') ?? '').searchParams.get(
    'correlation_id'
  )
}

function arrange(scenario: Scenario = {}) {
  activateBillingScope('actor-a', 'workspace-a')
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
      renewalDate: computed(() => null),
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
      canOpenPlans: computed(() =>
        receiveServerFact('can_open_plans', scenario.canOpenPlans ?? true)
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
      paymentRecoveryAvailable: computed(() =>
        receiveServerFact('payment_recovery_available', false)
      ),
      hasParkedBillingOperation: computed(() =>
        receiveServerFact(
          'has_parked_billing_operation',
          scenario.hasParkedBillingOperation ?? false
        )
      ),
      runDeniedPaymentPastDue: computed(() =>
        receiveServerFact('denied_reasons.can_run_workflows', false)
      ),
      canTopUp: computed(() => scenario.canTopUp ?? true),
      topUpDenial: computed(() => scenario.topUpDenial),
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
        expect(banner).toHaveClass('rounded-xl', 'p-3')
      }
    )

    it('uses md sizing for the owner action', () => {
      arrange({ isPaused: true, canManageBilling: true })

      expect(
        within(screen.getByTestId('billing-paused-banner')).getByRole(
          'button',
          { name: 'Update payment' }
        )
      ).toHaveClass('h-8')
    })

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

  describe('parked payment banner', () => {
    it('shows Contact support when a payment is parked', () => {
      arrange({ hasParkedBillingOperation: true })

      const banner = screen.getByTestId('billing-parked-banner')
      expect(banner).toHaveTextContent(
        'Something went wrong with a recent payment'
      )
      expect(banner).toHaveTextContent('Contact support so we can fix it.')
      expect(
        within(banner).getByRole('link', { name: 'Contact support' })
      ).toHaveAttribute('href', 'https://comfy.org/contact/')
    })

    it('hides the parked banner when the fact is absent', () => {
      arrange()

      expect(
        screen.queryByTestId('billing-parked-banner')
      ).not.toBeInTheDocument()
    })
  })

  it('shows out of credits on the local Billing tab when unified billing settings is on', () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    arrange({
      subscription: { ...activeSubscription, hasFunds: false }
    })

    const banner = screen.getByTestId('billing-local-credit-banner')
    expect(banner).toHaveTextContent('Out of credits')
    expect(banner).toHaveTextContent(
      "You've used all your credits. Add more credits."
    )
    expect(
      screen.queryByTestId('billing-paused-banner')
    ).not.toBeInTheDocument()
    expect(banner).not.toHaveTextContent('Subscription paused')
    expect(banner).not.toHaveTextContent('plan ends')
  })

  it('hides local credit banners when unified billing settings is off', () => {
    arrange({
      subscription: { ...activeSubscription, hasFunds: false },
      balance: {
        amountMicros: 500,
        currency: 'usd',
        lowBalance: true
      }
    })

    expect(
      screen.queryByTestId('billing-local-credit-banner')
    ).not.toBeInTheDocument()
  })

  it('shows a skeleton and no plan row while billing loads', () => {
    arrange({ isInitialized: false })

    const skeleton = screen.getByTestId('billing-plan-skeleton')
    expect(skeleton).toHaveClass('rounded-xl', 'border-card', 'px-5', 'py-4')
    expect(
      within(screen.getByTestId('billing-plan-section')).getByRole('heading', {
        name: 'Plan'
      })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('billing-plan-row')).not.toBeInTheDocument()
  })

  it('replaces the plan with one error that retries both reads', async () => {
    const { initialize, refresh } = arrange({ error: 'boom' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load your plan.")
    expect(alert).toHaveClass('rounded-xl', 'border-card', 'px-5', 'py-4')
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
    expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument()
  })

  it('lays out the plan and the owner handoff as headed 12px cards', () => {
    arrange()

    expect(screen.getByTestId('billing-tab')).toHaveClass('gap-12')
    const plan = screen.getByTestId('billing-plan-section')
    expect(plan).toHaveClass('gap-3')
    expect(within(plan).getByRole('heading', { name: 'Plan' })).toHaveClass(
      'text-base',
      'font-medium'
    )
    expect(within(plan).getByRole('heading', { name: 'Pro' })).toHaveClass(
      'text-sm',
      'font-semibold'
    )
    expect(within(plan).getByTestId('billing-plan-row')).toHaveClass(
      'rounded-xl',
      'border-card',
      'px-5',
      'py-4'
    )
    expect(within(plan).getByRole('button', { name: 'Manage' })).toHaveClass(
      'h-8'
    )
    const handoff = screen.getByTestId('billing-handoff')
    expect(handoff).toHaveClass('gap-3')
    expect(
      within(handoff).getByRole('heading', {
        name: 'Payment methods, invoices, and usage'
      })
    ).toHaveClass('text-base', 'font-medium')
    const handoffCard = within(handoff).getByTestId('billing-handoff-card')
    expect(handoffCard).toHaveClass('rounded-xl', 'border-card', 'px-5', 'py-4')
    expect(
      within(handoffCard).getByRole('link', { name: 'Open billing' })
    ).toContainHTML('icon-[lucide--arrow-up-right]')
  })

  it('returns to the served status when subscription_state is no longer activating', () => {
    arrange({ subscriptionState: 'active' })

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Billed monthly. Next invoice November 15.'
    )
    expect(screen.queryByText(/Activating your/)).not.toBeInTheDocument()
  })

  it('opens plan management on Cloud instead of a platform plans page', async () => {
    arrange()

    expect(
      screen.queryByRole('link', { name: 'Manage' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Manage' }))

    expect(
      useSubscriptionPaywall().showSubscriptionDialog
    ).toHaveBeenCalledWith({ reason: 'settings_billing_panel' })
    expect(screen.getByRole('link', { name: 'Open billing' })).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^https:\/\/platform\.test\/profile\/billing\?workspace=ws_1&correlation_id=.+$/
      )
    )
  })

  it('opens Subscribe on Cloud for a workspace with no plan', async () => {
    arrange({ subscription: null, subscriptionStatus: null })

    expect(
      screen.queryByRole('link', { name: 'Subscribe' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    expect(
      useSubscriptionPaywall().showSubscriptionDialog
    ).toHaveBeenCalledWith({ reason: 'settings_billing_panel' })
  })

  it('hides the plan action when the server does not grant it', () => {
    arrange({ canOpenPlans: false })

    expect(
      screen.queryByRole('button', { name: 'Manage' })
    ).not.toBeInTheDocument()
  })

  it('gives a member usage instead of billing and no plan action', () => {
    arrange({
      canManageSubscription: false,
      canManageBilling: false,
      canOpenPlans: false
    })

    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      'Managed by the workspace owner.'
    )
    const usage = screen.getByRole('link', { name: 'View usage' })
    expect(usage).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^https:\/\/platform\.test\/profile\/usage\?workspace=ws_1&correlation_id=.+$/
      )
    )
    expect(usage).toContainHTML('icon-[lucide--external-link]')
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
        expect.stringContaining(`https://platform.test${path}?workspace=ws_1`)
      )
    }
  )

  it.for([
    {
      name: 'the owner handoff',
      scenario: { canManageBilling: true },
      link: 'Open billing',
      destination: { target: 'open_billing' }
    },
    {
      name: 'the member handoff',
      scenario: {
        canManageBilling: false,
        canManageSubscription: false,
        canOpenPlans: false
      },
      link: 'View usage',
      destination: { target: 'usage' }
    }
  ] as const)(
    'reports a click on $name with the journey its link carried, then rotates it',
    async ({ scenario, link: name, destination }) => {
      arrange(scenario)
      const link = screen.getByRole('link', { name })
      const clickedId = correlationIdOf(link)
      link.addEventListener('click', (event) => event.preventDefault())

      await userEvent.click(link)

      expect(vi.mocked(useTelemetry)()?.trackBillingEvent).toHaveBeenCalledWith(
        {
          operation: 'platform_handoff',
          stage: 'opened',
          outcome: 'pending',
          correlation_id: clickedId,
          ...destination
        }
      )
      await vi.waitFor(() => expect(correlationIdOf(link)).not.toBe(clickedId))
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

    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalled()
  })

  describe('Auto top-up card', () => {
    it('shows the card when the flag is on and the server grants both facts', async () => {
      arrange()

      const credits = screen.getByTestId('billing-credits-section')
      expect(credits).toHaveClass('gap-3')
      expect(
        await within(credits).findByTestId('billing-auto-top-up-status')
      ).toHaveTextContent('Off')
    })

    it.for<{ case: string; scenario: Scenario; reads: number }>([
      {
        case: 'the flag is off',
        scenario: { autoTopUpFlag: false },
        reads: 0
      },
      {
        case: 'a member without can_manage_auto_top_up',
        scenario: { canManageAutoTopUp: false },
        reads: 0
      },
      {
        case: 'top-up is paused (can_top_up false)',
        scenario: { canTopUp: false },
        reads: 1
      }
    ])('hides the card when $case', ({ scenario, reads }) => {
      arrange(scenario)

      expect(
        screen.queryByTestId('billing-auto-top-up-card')
      ).not.toBeInTheDocument()
      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(reads)
    })

    it('reads the auto top-up settings once for the card and the banner', async () => {
      arrange({})
      await screen.findByTestId('billing-auto-top-up-status')

      expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
    })
  })
})

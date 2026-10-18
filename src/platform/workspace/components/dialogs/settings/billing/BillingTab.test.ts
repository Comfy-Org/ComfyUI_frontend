import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { reportError } from '@/platform/telemetry/reportError'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import BillingTab from './BillingTab.vue'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/billing/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/cloud/subscription/composables/useFreeTierQuota'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))
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
  isInitialized?: boolean
  error?: string | null
  role?: 'owner' | 'member'
  canSubscribeSelfServe?: boolean
  canRevertScheduledChange?: boolean
  canReactivate?: boolean
  resubscribe?: () => Promise<void>
  capabilitiesReady?: boolean
  capabilitiesResolved?: boolean
  balance?: BalanceInfo | null
}

function arrange(scenario: Scenario = {}) {
  const initialize = vi.fn(async () => {})
  const refresh = vi.fn(async () => {})
  const fetchStatus = vi.fn(async () => {})
  const resubscribe = vi.fn(scenario.resubscribe ?? (async () => {}))

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
      billingStatus: computed(() => 'paid'),
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
      canTopUp: computed(() => true),
      isReady: computed(() => scenario.capabilitiesReady ?? true),
      hasResolvedCapabilities: computed(
        () => scenario.capabilitiesResolved ?? true
      ),
      initialize: vi.fn(async () => {}),
      refresh
    })
  )
  vi.mocked(useWorkspaceUI).mockReturnValue(
    fromPartial({ workspaceRole: computed(() => scenario.role ?? 'owner') })
  )
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

  return { initialize, refresh, fetchStatus, resubscribe }
}

describe('BillingTab', () => {
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
    arrange({ role: 'member', canSubscribeSelfServe: false })

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
})

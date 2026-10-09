import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  BillingStatus,
  RenewalInvoice,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import BillingStatusBanner from '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue'

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
  tier?: SubscriptionInfo['tier']
  duration?: SubscriptionInfo['duration']
  scheduledChange?: SubscriptionInfo['scheduledChange']
}

const state = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: true,
  isTeamPlan: true,
  billingStatus: 'paid' as string | null,
  subscriptionStatus: 'active' as string | null,
  subscription: {
    hasFunds: true,
    isCancelled: false,
    endDate: null,
    scheduledChange: null
  } as Subscription | null,
  renewalDate: null as string | null,
  renewalInvoice: null as RenewalInvoice | null,
  workspaceType: 'team' as WorkspaceType,
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canReactivatePlan: true,
  shouldUseWorkspaceBilling: true,
  manageSubscription: vi.fn(),
  handleResubscribe: vi.fn(),
  showSubscriptionDialog: vi.fn()
}))

vi.mock<unknown>(import('@/composables/billing/useBillingRouting'), () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
  })
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: computed(
      () => state.canAccessSubscriptionFeatures
    ),
    isTeamPlan: computed(() => state.isTeamPlan),
    billingStatus: computed(() => state.billingStatus as BillingStatus | null),
    subscriptionStatus: computed(() => state.subscriptionStatus),
    subscription: computed(() => state.subscription),
    plans: computed(() => [
      { slug: 'pro-annual', tier: 'PRO', duration: 'ANNUAL' }
    ]),
    renewalDate: computed(() => state.renewalDate),
    renewalInvoice: computed(() => state.renewalInvoice),
    manageSubscription: state.manageSubscription,
    fetchStatus: vi.fn(),
    fetchBalance: vi.fn()
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  () => ({
    useWorkspaceUI: () => ({
      permissions: computed(() => ({
        canManageSubscription: state.canManageSubscription,
        canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
      })),
      workspaceType: computed(() => state.workspaceType),
      canReactivatePlan: computed(() => state.canReactivatePlan)
    })
  })
)

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/workspace/composables/useResubscribe'), () => ({
  useResubscribe: () => ({
    isResubscribing: computed(() => false),
    handleResubscribe: state.handleResubscribe
  })
}))

vi.mock(import('@/services/dialogService'))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog'),
  () => ({
    useSubscriptionDialog: () => ({ show: state.showSubscriptionDialog })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspacePanel: {
        members: {
          resubscribe: 'Resubscribe',
          endedTeamTitle: 'Your Team plan has ended',
          endedEnterpriseTitle: 'Your Enterprise plan has ended',
          endedPlanTitle: 'Your plan has ended'
        },
        billingStatus: {
          paused: {
            title: 'Subscription paused',
            body: "This workspace's subscription is paused. Update payment to resume.",
            memberBody:
              "Ask your workspace owner to restore the workspace's subscription."
          },
          outOfCredits: {
            title: 'Out of credits',
            body: 'Your team has used all its credits. Add more credits or wait until credits refill on {date}.',
            bodyNoDate: 'Your team has used all its credits. Add more credits.',
            personalBody:
              "You've used all your credits. Add more credits or wait until credits refill on {date}.",
            personalBodyNoDate:
              "You've used all your credits. Add more credits.",
            memberBody:
              'Your team has used all its credits. Ask your workspace owner to add more credits or wait until credits refill on {date}.',
            memberBodyNoDate:
              'Your team has used all its credits. Ask your workspace owner to add more credits.',
            addCredits: 'Add credits',
            dismiss: 'Dismiss'
          },
          ending: {
            title: 'Your Team plan ends on {date}',
            body: "You won't be charged again. Members keep full access until then. Resume your plan to keep your team's shared credits.",
            memberBody: 'You can run workflows until then.',
            personalTitle: 'Your {plan} plan ends on {date}',
            personalBody:
              "You won't be charged again. Resume your plan to keep getting credits.",
            enterpriseTitle: 'Your Enterprise plan ends on {date}',
            enterpriseBody:
              'Members keep full access until then. Reach out to our sales team to extend.',
            reactivate: 'Resume plan',
            contactSales: 'Contact sales'
          },
          planEnded: {
            teamTitle: 'Your Team plan ended on {date}',
            teamBody:
              'Resubscribe to run workflows and get shared credits again.',
            teamMemberBody: 'Ask your workspace owner to resubscribe.',
            personalTitle: 'Your {plan} plan ended on {date}',
            personalTitleNoDate: 'Your {plan} plan has ended',
            personalBody: 'Resubscribe to run workflows and get credits again.',
            enterpriseTitle: 'Your Enterprise plan ended on {date}',
            enterpriseBody: 'Contact sales to start a new Enterprise plan.',
            planTitle: 'Your plan ended on {date}',
            salesBody: 'Contact sales to start a new plan.',
            salesMemberBody: 'Ask your workspace owner to contact sales.'
          },
          planChange: {
            title: 'Your plan changes to {plan} on {date}.',
            body: 'Your current plan stays active until then.'
          },
          updatePayment: 'Update payment',
          payInvoice: 'Pay invoice'
        }
      },
      subscription: {
        upgradeToAddCredits: 'Upgrade to add credits',
        teamPlanName: 'Team',
        unknownTierName: 'Unknown',
        tiers: {
          standard: { name: 'Standard' },
          creator: { name: 'Creator' },
          founder: { name: "Founder's Edition" },
          pro: { name: 'Pro' },
          enterprise: { name: 'Enterprise' }
        }
      }
    }
  }
})

const globalOptions = {
  plugins: [i18n]
}

function renderBanner(section?: 'planCredits' | 'members' | 'allowlist') {
  return render(BillingStatusBanner, {
    props: { section },
    global: globalOptions
  })
}

function exhausted() {
  state.subscription = {
    hasFunds: false,
    isCancelled: false,
    endDate: null,
    scheduledChange: null
  }
}

function scheduledFor(planSlug: string) {
  state.subscription = {
    hasFunds: true,
    isCancelled: false,
    endDate: null,
    scheduledChange: {
      plan_slug: planSlug,
      effective_at: '2026-10-01T00:00:00Z',
      team_credit_stop: null
    }
  }
}

// The spend gate folds billing_status into is_active, so the backend never emits
// paused alongside an active subscription.
function pausedState() {
  state.billingStatus = 'paused'
  state.canAccessSubscriptionFeatures = false
}

function paymentFailedState() {
  state.billingStatus = 'payment_failed'
  state.canAccessSubscriptionFeatures = false
}

describe('BillingStatusBanner', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    state.canAccessSubscriptionFeatures = true
    state.isTeamPlan = true
    state.billingStatus = 'paid'
    state.subscriptionStatus = 'active'
    state.subscription = {
      hasFunds: true,
      isCancelled: false,
      endDate: null,
      scheduledChange: null
    }
    state.renewalDate = null
    state.renewalInvoice = null
    state.workspaceType = 'team'
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    useBillingCapabilities().canReactivate = computed(() => true)
    state.canReactivatePlan = true
    state.shouldUseWorkspaceBilling = true
  })

  it('renders nothing for a healthy funded team', () => {
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders nothing when billing control is rolled back, even out of credits', () => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = false
    state.subscription = {
      hasFunds: false,
      isCancelled: false,
      endDate: null,
      scheduledChange: null
    }
    renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows out-of-credits with an Add credits action for owners', async () => {
    state.subscription = {
      hasFunds: false,
      isCancelled: false,
      endDate: null,
      scheduledChange: null
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Out of credits')
    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))
    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledTimes(1)
  })

  it('shows no out-of-credits banner to an owner who cannot buy credits', () => {
    exhausted()
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('points members to the owner without an Add credits action', () => {
    state.subscription = {
      hasFunds: false,
      isCancelled: false,
      endDate: null,
      scheduledChange: null
    }
    state.canManageSubscription = false
    useBillingCapabilities().canTopUp = computed(() => false)
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Ask your workspace owner to add more credits'
    )
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('dismisses the out-of-credits banner for the session', async () => {
    exhausted()
    renderBanner()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shares one dismiss across instances rather than tracking it per mount', async () => {
    exhausted()
    render(
      {
        components: { BillingStatusBanner },
        template: '<div><BillingStatusBanner /><BillingStatusBanner /></div>'
      },
      { global: globalOptions }
    )

    expect(screen.getAllByRole('status')).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the paused banner with Update payment for owners', async () => {
    pausedState()
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Subscription paused')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Update payment to resume'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )
    expect(state.manageSubscription).toHaveBeenCalledTimes(1)
  })

  it('shows the paused member notice without an action', () => {
    pausedState()
    state.canManageSubscription = false
    useBillingCapabilities().canTopUp = computed(() => false)
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      "Ask your workspace owner to restore the workspace's subscription"
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('renewal invoice', () => {
    const invoice: RenewalInvoice = {
      hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1/test_123',
      amount_due: 5000,
      currency: 'usd'
    }

    it('offers Pay invoice next to Update payment', () => {
      paymentFailedState()
      state.renewalInvoice = invoice
      renderBanner()

      expect(
        screen.getByRole('button', { name: 'Pay invoice' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Update payment' })
      ).toBeInTheDocument()
    })

    it('offers Pay invoice on a paused workspace', () => {
      pausedState()
      state.renewalInvoice = invoice
      renderBanner()

      expect(
        screen.getByRole('button', { name: 'Pay invoice' })
      ).toBeInTheDocument()
    })

    it('omits Pay invoice when there is no renewal invoice', () => {
      paymentFailedState()
      renderBanner()

      expect(
        screen.queryByRole('button', { name: 'Pay invoice' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Update payment' })
      ).toBeInTheDocument()
    })

    it('opens the hosted invoice URL in a new tab with noopener and noreferrer', async () => {
      paymentFailedState()
      state.renewalInvoice = invoice
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      renderBanner()

      await userEvent.click(screen.getByRole('button', { name: 'Pay invoice' }))

      expect(open).toHaveBeenCalledWith(
        invoice.hosted_invoice_url,
        '_blank',
        'noopener,noreferrer'
      )
      open.mockRestore()
    })

    it('hides Pay invoice for a non-https invoice URL', () => {
      paymentFailedState()
      state.renewalInvoice = {
        ...invoice,
        hosted_invoice_url: 'javascript:alert(1)'
      }
      renderBanner()

      expect(
        screen.queryByRole('button', { name: 'Pay invoice' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Update payment' })
      ).toBeInTheDocument()
    })
  })

  it('shows the paused copy for a failed renewal, since runs are already blocked', () => {
    paymentFailedState()
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent('Subscription paused')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Update payment to resume'
    )
    expect(
      screen.getByRole('button', { name: 'Update payment' })
    ).toBeInTheDocument()
  })

  it.for([
    { name: 'paused', enter: pausedState },
    { name: 'payment failed', enter: paymentFailedState }
  ])(
    'gives a personal owner the workspace copy when $name',
    async ({ enter }) => {
      enter()
      state.isTeamPlan = false
      state.workspaceType = 'personal'
      state.subscription = { ...state.subscription!, tier: 'PRO' }
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        "This workspace's subscription is paused. Update payment to resume."
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Update payment' })
      )
      expect(state.manageSubscription).toHaveBeenCalledTimes(1)
    }
  )

  it('points members to the owner on a failed renewal, without payment controls', () => {
    paymentFailedState()
    state.canManageSubscription = false
    state.renewalInvoice = {
      hosted_invoice_url: 'https://invoice.stripe.com/i/acct_1/test_123',
      amount_due: 5000,
      currency: 'usd'
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      "Ask your workspace owner to restore the workspace's subscription."
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })

  it('hides payment recovery states while preserving existing notices when the new flag is off', () => {
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = false
    paymentFailedState()
    const { unmount } = renderBanner()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()

    state.canAccessSubscriptionFeatures = true
    state.billingStatus = 'paid'
    exhausted()
    renderBanner()
    expect(screen.getByRole('status')).toHaveTextContent('Out of credits')
  })

  it('lets a promoted owner reactivate an ending plan', async () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z',
      scheduledChange: null
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your Team plan ends on'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Resume plan' }))
    expect(state.handleResubscribe).toHaveBeenCalledTimes(1)
  })

  it('keeps reactivation on the legacy rail where the capability does not apply', async () => {
    // Cloud personal on legacy_stripe: handleResubscribe skips its capability
    // guard, so the affordance must follow the client permission instead.
    state.shouldUseWorkspaceBilling = false
    useBillingCapabilities().canReactivate = computed(() => false)
    state.canManageSubscriptionLifecycle = true
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z',
      scheduledChange: null
    }
    renderBanner()

    await userEvent.click(screen.getByRole('button', { name: 'Resume plan' }))
    expect(state.handleResubscribe).toHaveBeenCalledTimes(1)
  })

  it('shows members the ending notice without a Resume plan action', () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z',
      scheduledChange: null
    }
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    useBillingCapabilities().canReactivate = computed(() => false)
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'You can run workflows until then.'
    )
    expect(
      screen.queryByRole('button', { name: 'Resume plan' })
    ).not.toBeInTheDocument()
  })

  it('hides reactivation when the server denies it to a client-side owner', () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z',
      scheduledChange: null
    }
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivatePlan = false
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your Team plan ends on'
    )
    expect(
      screen.queryByRole('button', { name: 'Resume plan' })
    ).not.toBeInTheDocument()
  })

  it('names the destination plan and date for a scheduled change', () => {
    scheduledFor('pro-annual')
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your plan changes to Pro on October 1, 2026.'
    )
  })

  it('still renders the ending banner when the end date is malformed', () => {
    state.subscription = {
      hasFunds: true,
      isCancelled: true,
      endDate: 'not-a-date',
      scheduledChange: null
    }
    renderBanner()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Members keep full access until then.'
    )
  })

  it('dismisses a scheduled change banner', async () => {
    scheduledFor('pro-annual')
    renderBanner()

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('quotes no price for a scheduled change', () => {
    scheduledFor('pro-annual')
    renderBanner()

    expect(screen.getByRole('status')).not.toHaveTextContent('$')
  })

  it('stays silent when the destination plan is absent from the catalog', () => {
    scheduledFor('plan-the-client-does-not-know')
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('plan ended', () => {
    function endedPlan(tier: SubscriptionInfo['tier'] = 'PRO') {
      state.subscriptionStatus = 'ended'
      state.billingStatus = 'inactive'
      state.canAccessSubscriptionFeatures = false
      state.subscription = {
        hasFunds: false,
        isCancelled: true,
        endDate: '2026-09-12T12:00:00Z',
        scheduledChange: null,
        tier
      }
    }

    it('lets a team owner resubscribe through the pricing table', async () => {
      endedPlan()
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'Your Team plan ended on September 12, 2026'
      )
      await userEvent.click(screen.getByRole('button', { name: 'Resubscribe' }))
      expect(state.showSubscriptionDialog).toHaveBeenCalledWith(
        expect.objectContaining({ planMode: 'team' })
      )
    })

    it('points a team member to the owner', () => {
      endedPlan()
      state.canManageSubscription = false
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'Ask your workspace owner to resubscribe.'
      )
      expect(
        screen.queryByRole('button', { name: 'Resubscribe' })
      ).not.toBeInTheDocument()
    })

    it('sends an Enterprise owner to sales', async () => {
      endedPlan('ENTERPRISE')
      state.isTeamPlan = false
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'Your Enterprise plan ended on September 12, 2026'
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Contact sales' })
      )
      expect(open).toHaveBeenCalledWith(
        'https://comfy.org/cloud/enterprise/',
        '_blank',
        'noopener,noreferrer'
      )
      open.mockRestore()
    })

    it('dismisses for the session', async () => {
      endedPlan()
      renderBanner()

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows even when billing control is rolled back', () => {
      endedPlan()
      vi.mocked(useFeatureFlags().flags).billingControlEnabled = false
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'Your Team plan ended on'
      )
    })
  })

  describe('enterprise ending notice', () => {
    const NOW = new Date('2026-09-03T12:00:00Z')
    const DAY = 24 * 60 * 60 * 1000

    // The project vitest setup fakes timers for every test, so pinning the
    // clock is just a setSystemTime away.
    beforeEach(() => {
      vi.setSystemTime(NOW)
    })

    function enterpriseEndingIn(days: number) {
      state.isTeamPlan = false
      state.subscription = {
        hasFunds: true,
        isCancelled: true,
        endDate: new Date(NOW.getTime() + days * DAY).toISOString(),
        tier: 'ENTERPRISE'
      }
    }

    it('shows no banner while the end date is beyond the notice window', () => {
      enterpriseEndingIn(30)
      renderBanner()

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows enterprise copy without a Reactivate action inside the window', () => {
      enterpriseEndingIn(10)
      // Pin the gate itself: even a rail that resolves reactivation true for
      // an Enterprise plan must not surface the action.
      state.canReactivatePlan = true
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'Your Enterprise plan ends on'
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Reach out to our sales team to extend'
      )
      expect(
        screen.queryByRole('button', { name: 'Resume plan' })
      ).not.toBeInTheDocument()
    })

    it('sends owners to sales', async () => {
      enterpriseEndingIn(10)
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      renderBanner()

      await userEvent.click(
        screen.getByRole('button', { name: 'Contact sales' })
      )

      expect(open).toHaveBeenCalledWith(
        'https://comfy.org/cloud/enterprise/',
        '_blank',
        'noopener,noreferrer'
      )
      open.mockRestore()
    })

    it('tells members they can run until the end date, with no action', () => {
      enterpriseEndingIn(10)
      state.canManageSubscription = false
      renderBanner()

      expect(screen.getByRole('status')).toHaveTextContent(
        'You can run workflows until then.'
      )
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('personal plan', () => {
    function personalPlan(tier: SubscriptionInfo['tier'] = 'PRO') {
      state.isTeamPlan = false
      state.workspaceType = 'personal'
      state.subscription = { ...state.subscription!, tier }
    }

    function endingPlan() {
      state.subscription = {
        ...state.subscription!,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      }
    }

    function endedPlan(endDate: string | null) {
      state.subscriptionStatus = 'ended'
      state.billingStatus = 'inactive'
      state.canAccessSubscriptionFeatures = false
      state.subscription = {
        ...state.subscription!,
        hasFunds: false,
        isCancelled: true,
        endDate
      }
    }

    describe('out of credits', () => {
      const NOW = new Date('2026-10-08T12:00:00Z')
      const DAY = 24 * 60 * 60 * 1000

      beforeEach(() => {
        vi.setSystemTime(NOW)
      })

      const HOUR = 60 * 60 * 1000
      const inDays = (days: number) => new Date(NOW.getTime() + days * DAY)
      const iso = (date: Date) => date.toISOString()

      it.for([
        {
          case: 'monthly team, refill in 20 days',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'MONTHLY',
          renewalDate: iso(inDays(20)),
          body: 'Your team has used all its credits. Add more credits or wait until credits refill on October 28.'
        },
        {
          case: 'monthly team, refill just past 31 days',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'MONTHLY',
          renewalDate: iso(new Date(inDays(31).getTime() + HOUR)),
          body: 'Your team has used all its credits. Add more credits or wait until credits refill on November 8.'
        },
        {
          case: 'monthly team, refill date already past',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'MONTHLY',
          renewalDate: iso(inDays(-2)),
          body: 'Your team has used all its credits. Add more credits.'
        },
        {
          case: 'monthly team, no refill date',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'MONTHLY',
          renewalDate: null,
          body: 'Your team has used all its credits. Add more credits.'
        },
        {
          case: 'annual team, refill in 20 days',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'ANNUAL',
          renewalDate: iso(inDays(20)),
          body: 'Your team has used all its credits. Add more credits or wait until credits refill on October 28, 2026.'
        },
        {
          case: 'annual team, refill in exactly 31 days',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'ANNUAL',
          renewalDate: iso(inDays(31)),
          body: 'Your team has used all its credits. Add more credits or wait until credits refill on November 8, 2026.'
        },
        {
          case: 'annual team, refill just past 31 days',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'ANNUAL',
          renewalDate: iso(new Date(inDays(31).getTime() + HOUR)),
          body: 'Your team has used all its credits. Add more credits.'
        },
        {
          case: 'annual team, refill in 5 months',
          workspaceType: 'team',
          isTeamPlan: true,
          tier: 'TEAM',
          duration: 'ANNUAL',
          renewalDate: iso(inDays(150)),
          body: 'Your team has used all its credits. Add more credits.'
        },
        {
          case: 'monthly personal, refill in 10 days',
          workspaceType: 'personal',
          isTeamPlan: false,
          tier: 'PRO',
          duration: 'MONTHLY',
          renewalDate: iso(inDays(10)),
          body: "You've used all your credits. Add more credits or wait until credits refill on October 18."
        },
        {
          case: 'annual personal, refill in 5 months',
          workspaceType: 'personal',
          isTeamPlan: false,
          tier: 'PRO',
          duration: 'ANNUAL',
          renewalDate: iso(inDays(150)),
          body: "You've used all your credits. Add more credits."
        },
        {
          case: 'Founders Edition, no duration, refill in 10 days',
          workspaceType: 'personal',
          isTeamPlan: false,
          tier: 'FOUNDERS_EDITION',
          duration: null,
          renewalDate: iso(inDays(10)),
          body: "You've used all your credits. Add more credits or wait until credits refill on October 18."
        },
        {
          case: 'paid plan with no duration, refill in 10 days',
          workspaceType: 'personal',
          isTeamPlan: false,
          tier: 'PRO',
          duration: null,
          renewalDate: iso(inDays(10)),
          body: "You've used all your credits. Add more credits."
        }
      ] as const)(
        'words out of credits for the owner ($case)',
        async ({
          workspaceType,
          isTeamPlan,
          tier,
          duration,
          renewalDate,
          body
        }) => {
          state.workspaceType = workspaceType
          state.isTeamPlan = isTeamPlan
          state.renewalDate = renewalDate
          state.subscription = {
            ...state.subscription!,
            tier,
            duration,
            hasFunds: false
          }
          renderBanner()

          expect(screen.getByRole('status')).toHaveTextContent(body)
          await userEvent.click(
            screen.getByRole('button', { name: 'Add credits' })
          )
          expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalled()
        }
      )

      it.for([
        {
          case: 'monthly, refill in 10 days',
          duration: 'MONTHLY',
          renewalDate: iso(inDays(10)),
          body: 'Your team has used all its credits. Ask your workspace owner to add more credits or wait until credits refill on October 18.'
        },
        {
          case: 'annual, refill in 5 months',
          duration: 'ANNUAL',
          renewalDate: iso(inDays(150)),
          body: 'Your team has used all its credits. Ask your workspace owner to add more credits.'
        }
      ] as const)(
        'words out of credits for a member ($case)',
        ({ duration, renewalDate, body }) => {
          state.canManageSubscription = false
          state.renewalDate = renewalDate
          state.subscription = {
            ...state.subscription!,
            duration,
            hasFunds: false
          }
          renderBanner()

          expect(screen.getByRole('status')).toHaveTextContent(body)
        }
      )

      it('starts suggesting the wait when an annual refill enters the window while open', async () => {
        state.workspaceType = 'team'
        state.isTeamPlan = true
        state.renewalDate = iso(new Date(inDays(31).getTime() + 90_000))
        state.subscription = {
          ...state.subscription!,
          tier: 'TEAM',
          duration: 'ANNUAL',
          hasFunds: false
        }
        renderBanner()
        expect(screen.getByRole('status')).toHaveTextContent(
          'Your team has used all its credits. Add more credits.'
        )

        await vi.advanceTimersByTimeAsync(2 * 60_000)

        expect(screen.getByRole('status')).toHaveTextContent(
          'Your team has used all its credits. Add more credits or wait until credits refill on November 8, 2026.'
        )
      })

      it('drops the suggestion when the refill date passes while open', async () => {
        state.workspaceType = 'team'
        state.isTeamPlan = true
        state.renewalDate = iso(new Date(NOW.getTime() + 30_000))
        state.subscription = {
          ...state.subscription!,
          tier: 'TEAM',
          duration: 'MONTHLY',
          hasFunds: false
        }
        renderBanner()
        expect(screen.getByRole('status')).toHaveTextContent(
          'Your team has used all its credits. Add more credits or wait until credits refill on October 8.'
        )

        await vi.advanceTimersByTimeAsync(2 * 60_000)

        expect(screen.getByRole('status')).toHaveTextContent(
          'Your team has used all its credits. Add more credits.'
        )
      })
    })

    it.for([
      {
        tier: null,
        title: 'Your Team plan ends on August 1, 2026',
        body: "You won't be charged again. Members keep full access until then. Resume your plan to keep your team's shared credits."
      },
      {
        tier: 'PRO',
        title: 'Your Pro plan ends on August 1, 2026',
        body: "You won't be charged again. Resume your plan to keep getting credits."
      },
      {
        tier: 'FOUNDERS_EDITION',
        title: "Your Founder's Edition plan ends on August 1, 2026",
        body: "You won't be charged again. Resume your plan to keep getting credits."
      }
    ] as const)(
      'words the ending notice for $title',
      async ({ tier, title, body }) => {
        if (tier) personalPlan(tier)
        endingPlan()
        renderBanner()

        expect(screen.getByRole('status')).toHaveTextContent(title)
        expect(screen.getByRole('status')).toHaveTextContent(body)
        await userEvent.click(
          screen.getByRole('button', { name: 'Resume plan' })
        )
        expect(state.handleResubscribe).toHaveBeenCalledTimes(1)
      }
    )

    it.for([
      {
        endDate: '2026-09-12T12:00:00Z',
        title: 'Your Creator plan ended on September 12, 2026'
      },
      { endDate: null, title: 'Your Creator plan has ended' }
    ])(
      'tells an ended personal plan "$title" and resubscribes on Personal plans',
      async ({ endDate, title }) => {
        personalPlan('CREATOR')
        endedPlan(endDate)
        renderBanner()

        expect(screen.getByRole('status')).toHaveTextContent(title)
        expect(screen.getByRole('status')).toHaveTextContent(
          'Resubscribe to run workflows and get credits again.'
        )
        await userEvent.click(
          screen.getByRole('button', { name: 'Resubscribe' })
        )
        expect(state.showSubscriptionDialog).toHaveBeenCalledWith(
          expect.objectContaining({ planMode: 'personal' })
        )
      }
    )

    it('dismisses an ended personal plan for the session', async () => {
      personalPlan()
      endedPlan('2026-09-12T12:00:00Z')
      renderBanner()

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows no banner for an ended plan on an unrecognized tier', () => {
      state.isTeamPlan = false
      state.workspaceType = 'personal'
      endedPlan('2026-09-12T12:00:00Z')
      state.subscription = { ...state.subscription!, tier: null }
      renderBanner()

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    describe('on the Members tab', () => {
      it.for([
        { name: 'plan ended', enter: () => endedPlan('2026-09-12T12:00:00Z') },
        { name: 'ending', enter: endingPlan },
        {
          name: 'plan change',
          enter: () => {
            state.isTeamPlan = true
            scheduledFor('pro-annual')
          }
        }
      ])('hides $name in a personal workspace', ({ enter }) => {
        personalPlan()
        enter()
        renderBanner('members')

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      it.for([
        { name: 'paused', enter: pausedState, text: 'Subscription paused' },
        {
          name: 'payment failed',
          enter: paymentFailedState,
          text: 'Subscription paused'
        },
        {
          name: 'out of credits',
          enter: () => {
            state.subscription = { ...state.subscription!, hasFunds: false }
          },
          text: 'Out of credits'
        }
      ])('keeps $name in a personal workspace', ({ enter, text }) => {
        personalPlan()
        enter()
        renderBanner('members')

        expect(screen.getByRole('status')).toHaveTextContent(text)
      })

      it('keeps the ending notice on the Plan & Credits tab', () => {
        personalPlan()
        endingPlan()
        renderBanner('planCredits')

        expect(screen.getByRole('status')).toHaveTextContent(
          'Your Pro plan ends on'
        )
      })

      it.for([
        {
          name: 'plan ended',
          enter: () => endedPlan('2026-09-12T12:00:00Z'),
          text: 'Your Team plan ended on'
        },
        { name: 'ending', enter: endingPlan, text: 'Your Team plan ends on' },
        {
          name: 'plan change',
          enter: () => scheduledFor('pro-annual'),
          text: 'Your plan changes to Pro'
        }
      ])('keeps $name in a team workspace', ({ enter, text }) => {
        state.subscription = { ...state.subscription!, tier: 'PRO' }
        enter()
        renderBanner('members')

        expect(screen.getByRole('status')).toHaveTextContent(text)
      })
    })
  })
})

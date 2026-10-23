import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  canManageBillingFact,
  runDeniedPaymentPastDueFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BillingPortalOutcome,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import type {
  BillingStatus,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import BillingStatusBanner from '@/platform/billing/components/settings/BillingStatusBanner.vue'

interface Subscription {
  hasFunds: boolean
  isCancelled: boolean
  endDate: string | null
  tier?: SubscriptionInfo['tier']
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
  workspaceType: 'team' as WorkspaceType,
  canManageSubscription: true,
  canManageSubscriptionLifecycle: true,
  canReactivatePlan: true,
  shouldUseWorkspaceBilling: true,
  manageSubscription: vi.fn(
    async (): Promise<BillingPortalOutcome> => ({ ok: true })
  ),
  handleResubscribe: vi.fn(),
  showSubscriptionDialog: vi.fn()
}))

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingRouting'),
  () => ({
    useBillingRouting: () => ({
      shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
    })
  })
)

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({
      canAccessSubscriptionFeatures: computed(
        () => state.canAccessSubscriptionFeatures
      ),
      isTeamPlan: computed(() => state.isTeamPlan),
      billingStatus: computed(
        () => state.billingStatus as BillingStatus | null
      ),
      subscriptionStatus: computed(() => state.subscriptionStatus),
      subscription: computed(() => state.subscription),
      plans: computed(() => [
        { slug: 'pro-annual', tier: 'PRO', duration: 'ANNUAL' }
      ]),
      renewalDate: computed(() => state.renewalDate),
      manageSubscription: state.manageSubscription,
      fetchStatus: vi.fn(),
      fetchBalance: vi.fn()
    })
  })
)

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

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/billing/composables/useResubscribe'), () => ({
  useResubscribe: () => ({
    isResubscribing: computed(() => false),
    handleResubscribe: state.handleResubscribe
  })
}))

vi.mock(import('@/platform/billing/composables/useBillingDialogs'))

vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog'),
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
          outOfCredits: {
            title: 'Out of credits',
            body: 'Your team has used all its credits. Add more credits or wait until credits refill on {date}.',
            bodyNoDate: 'Your team has used all its credits. Add more credits.',
            personalBody:
              "You've used all your credits. Add more credits or wait until credits refill on {date}.",
            personalBodyNoDate:
              "You've used all your credits. Add more credits.",
            pastDueBody:
              'Your team has used all its credits. Update your payment method to add more.',
            pastDueMemberBody:
              'Your team has used all its credits. Ask your workspace owner to update the payment method.',
            pastDuePersonalBody:
              "You've used all your credits. Update your payment method to add more.",
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
              "You won't be charged again. Resume your plan to keep your monthly credits.",
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
            personalBody:
              'Resubscribe to run workflows and get monthly credits again.',
            enterpriseTitle: 'Your Enterprise plan ended on {date}',
            enterpriseBody: 'Contact sales to start a new Enterprise plan.',
            planTitle: 'Your plan ended on {date}',
            salesBody: 'Contact sales to start a new plan.',
            salesMemberBody: 'Ask your workspace owner to contact sales.'
          },
          paused: {
            body: "This workspace's subscription is paused. Update payment to resume."
          },
          planChange: {
            title: 'Your plan changes to {plan} on {date}.',
            body: 'Your current plan stays active until then.'
          },
          updatePayment: 'Update payment'
        }
      },
      subscription: {
        teamPlanName: 'Team',
        unknownTierName: 'Unknown',
        tiers: {
          standard: { name: 'Standard' },
          creator: { name: 'Creator' },
          founder: { name: "Founder's Edition" },
          pro: { name: 'Pro' },
          enterprise: { name: 'Enterprise' }
        },
        paymentRecovery: {
          title: 'Subscription paused',
          memberDescription:
            "Ask your workspace owner to restore the workspace's subscription."
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

function pausedState() {
  state.billingStatus = 'paused'
  state.canAccessSubscriptionFeatures = false
}

function paymentFailedState() {
  state.billingStatus = 'payment_failed'
  state.canAccessSubscriptionFeatures = false
}

function personalProWorkspace() {
  state.isTeamPlan = false
  state.workspaceType = 'personal'
  state.subscription = {
    hasFunds: true,
    isCancelled: false,
    endDate: null,
    scheduledChange: null,
    tier: 'PRO'
  }
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
    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledTimes(1)
  })

  it('shows no out-of-credits banner to an owner who cannot buy credits', () => {
    exhausted()
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.for([
    {
      audience: 'team',
      canManageBilling: true,
      body: 'Your team has used all its credits. Update your payment method to add more.',
      buttons: ['Dismiss', 'Update payment']
    },
    {
      audience: 'team',
      canManageBilling: false,
      body: 'Your team has used all its credits. Ask your workspace owner to update the payment method.',
      buttons: ['Dismiss']
    },
    {
      audience: 'personal',
      canManageBilling: true,
      body: "You've used all your credits. Update your payment method to add more.",
      buttons: ['Dismiss', 'Update payment']
    }
  ] as const)(
    'shows the past-due out-of-credits copy for a $audience workspace with billing management $canManageBilling',
    ({ audience, canManageBilling, body, buttons }) => {
      if (audience === 'personal') personalProWorkspace()
      state.subscription = {
        hasFunds: false,
        isCancelled: false,
        endDate: null,
        scheduledChange: null,
        tier: audience === 'personal' ? 'PRO' : undefined
      }
      state.renewalDate = '2026-11-01T00:00:00Z'
      useBillingCapabilities().canTopUp = computed(() => false)
      useBillingCapabilities().topUpDenial = computed(() => 'payment_past_due')
      useBillingCapabilities().canManageBilling =
        canManageBillingFact(canManageBilling)

      renderBanner()

      const banner = screen.getByRole('status')
      expect(banner).toHaveTextContent('Out of credits')
      expect(banner).toHaveTextContent(body)
      expect(
        screen
          .queryAllByRole('button')
          .map((button) => button.textContent.trim())
      ).toEqual(buttons)
    }
  )

  it('shows the past-due copy when run is denied and top-up is still allowed', () => {
    exhausted()
    useBillingCapabilities().runDeniedPaymentPastDue =
      runDeniedPaymentPastDueFact(true)
    useBillingCapabilities().canManageBilling = canManageBillingFact(true)

    renderBanner()

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Out of credits')
    expect(banner).toHaveTextContent(
      'Your team has used all its credits. Update your payment method to add more.'
    )
    expect(
      screen.getByRole('button', { name: 'Update payment' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
  })

  it('opens the billing portal from the past-due out-of-credits banner', async () => {
    exhausted()
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().topUpDenial = computed(() => 'payment_past_due')
    useBillingCapabilities().canManageBilling = canManageBillingFact(true)

    renderBanner()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )

    expect(state.manageSubscription).toHaveBeenCalledOnce()
    expect(useBillingDialogs().showTopUpCreditsDialog).not.toHaveBeenCalled()
  })

  describe('past-due Update payment', () => {
    beforeEach(() => {
      exhausted()
      useBillingCapabilities().canTopUp = computed(() => false)
      useBillingCapabilities().topUpDenial = computed(() => 'payment_past_due')
    })

    it('opens the portal once while a request is in flight', async () => {
      let resolvePortal: (outcome: BillingPortalOutcome) => void = () => {}
      state.manageSubscription.mockReturnValueOnce(
        new Promise<BillingPortalOutcome>((resolve) => {
          resolvePortal = resolve
        })
      )
      renderBanner()
      const button = screen.getByRole('button', { name: 'Update payment' })

      await userEvent.click(button)

      expect(button).toHaveAttribute('aria-busy', 'true')
      await userEvent.click(button)
      expect(state.manageSubscription).toHaveBeenCalledOnce()

      resolvePortal({ ok: true })
      await vi.waitFor(() => expect(button).toBeEnabled())
    })

    it('recovers from a failed portal request so the owner can retry', async () => {
      state.manageSubscription.mockRejectedValueOnce(new Error('portal down'))
      renderBanner()
      const button = screen.getByRole('button', { name: 'Update payment' })

      await userEvent.click(button)
      await vi.waitFor(() => expect(button).toBeEnabled())
      await userEvent.click(button)

      expect(state.manageSubscription).toHaveBeenCalledTimes(2)
    })
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

  const PAUSED_OWNER = {
    body: "This workspace's subscription is paused. Update payment to resume.",
    buttons: ['Update payment']
  }
  const PAUSED_MEMBER = {
    body: "Ask your workspace owner to restore the workspace's subscription.",
    buttons: []
  }

  it.for<{
    name: string
    personal?: boolean
    exhausted?: boolean
    planEnded?: boolean
    canManageBilling: boolean
    body: string
    buttons: string[]
  }>([
    { name: 'a team owner', canManageBilling: true, ...PAUSED_OWNER },
    { name: 'a team member', canManageBilling: false, ...PAUSED_MEMBER },
    {
      name: 'a personal owner',
      personal: true,
      canManageBilling: true,
      ...PAUSED_OWNER
    },
    {
      name: 'an exhausted team owner',
      exhausted: true,
      canManageBilling: true,
      ...PAUSED_OWNER
    },
    {
      name: 'a team owner whose plan ended',
      planEnded: true,
      canManageBilling: true,
      ...PAUSED_OWNER
    }
  ])(
    'shows the Subscription paused banner to $name',
    ({
      personal,
      exhausted: isExhausted,
      planEnded,
      canManageBilling,
      body,
      buttons
    }) => {
      if (personal) personalProWorkspace()
      if (isExhausted) exhausted()
      if (planEnded) state.subscriptionStatus = 'ended'
      pausedState()
      useBillingCapabilities().canManageBilling =
        canManageBillingFact(canManageBilling)

      renderBanner()

      const banner = screen.getByRole('status')
      expect(banner).toHaveTextContent('Subscription paused')
      expect(banner).toHaveTextContent(body)
      expect(
        screen
          .queryAllByRole('button')
          .map((button) => button.textContent.trim())
      ).toEqual(buttons)
    }
  )

  it.for([
    { name: 'a team workspace', enter: paymentFailedState },
    {
      name: 'a personal workspace',
      enter: () => {
        personalProWorkspace()
        paymentFailedState()
      }
    }
  ])('shows no banner for payment failed in $name', ({ enter }) => {
    enter()
    renderBanner()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('opens the billing portal from the paused banner', async () => {
    pausedState()
    useBillingCapabilities().canManageBilling = canManageBillingFact(true)

    renderBanner()
    await userEvent.click(
      screen.getByRole('button', { name: 'Update payment' })
    )

    expect(state.manageSubscription).toHaveBeenCalledOnce()
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

    it.for([
      {
        personal: false,
        renewalDate: '2026-10-01T00:00:00Z',
        body: 'Your team has used all its credits. Add more credits or wait until credits refill on October 1, 2026.'
      },
      {
        personal: false,
        renewalDate: null,
        body: 'Your team has used all its credits. Add more credits.'
      },
      {
        personal: true,
        renewalDate: '2026-10-01T00:00:00Z',
        body: "You've used all your credits. Add more credits or wait until credits refill on October 1, 2026."
      },
      {
        personal: true,
        renewalDate: null,
        body: "You've used all your credits. Add more credits."
      }
    ])(
      'words out of credits for the audience (personal: $personal, date: $renewalDate)',
      async ({ personal, renewalDate, body }) => {
        if (personal) personalPlan()
        state.renewalDate = renewalDate
        state.subscription = { ...state.subscription!, hasFunds: false }
        renderBanner()

        expect(screen.getByRole('status')).toHaveTextContent(body)
        await userEvent.click(
          screen.getByRole('button', { name: 'Add credits' })
        )
        expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalled()
      }
    )

    it.for([
      {
        tier: null,
        title: 'Your Team plan ends on August 1, 2026',
        body: "You won't be charged again. Members keep full access until then. Resume your plan to keep your team's shared credits."
      },
      {
        tier: 'PRO',
        title: 'Your Pro plan ends on August 1, 2026',
        body: "You won't be charged again. Resume your plan to keep your monthly credits."
      },
      {
        tier: 'FOUNDERS_EDITION',
        title: "Your Founder's Edition plan ends on August 1, 2026",
        body: "You won't be charged again. Resume your plan to keep your monthly credits."
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
          'Resubscribe to run workflows and get monthly credits again.'
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

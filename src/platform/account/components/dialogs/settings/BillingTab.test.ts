import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type {
  BillingCapabilitiesResponse,
  HostedTopupCheckout,
  SubscriptionState
} from '@comfyorg/ingest-types'

import { i18n } from '@/i18n'
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
import type { Plan } from '@comfyorg/billing-core'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { billingApi } from '@/platform/billing/api/billingApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { activateBillingScope } from '@/platform/billing/__tests__/activateBillingScope'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePausedBanner } from '@/platform/billing/composables/usePausedBanner'
import { useMessageSupport } from '@/platform/billing/subscription/composables/useSubscriptionActions'

import BillingTab from '@/platform/account/components/dialogs/settings/BillingTab.vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/billing/composables/usePausedBanner'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/billing/composables/useSubscriptionPaywall'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingUI'))
vi.mock(import('@/platform/billing/subscription/composables/useFreeTierQuota'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionActions')
)
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
  planKind?: NonNullable<BillingCapabilitiesResponse['plan_kind']> | null
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
  billingStatus?: 'paid' | 'paused'
  hasParkedBillingOperation?: boolean
}

function correlationIdOf(link: HTMLElement) {
  return new URL(link.getAttribute('href') ?? '').searchParams.get(
    'correlation_id'
  )
}

const handleMessageSupport = vi.fn(async () => {})

function arrange(scenario: Scenario = {}) {
  activateBillingScope('actor-a', 'workspace-a')
  vi.mocked(useMessageSupport).mockReturnValue({
    isLoadingSupport: ref(false),
    handleMessageSupport
  })
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
      billingStatus: computed(() => scenario.billingStatus ?? 'paid'),
      canAccessSubscriptionFeatures: computed(() => true),
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
      planKind: computed(() =>
        receiveServerFact('plan_kind', scenario.planKind ?? null)
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
    it.for([
      { name: 'an owner', canManageBilling: true, shown: true },
      { name: 'a member', canManageBilling: false, shown: false }
    ])(
      'shows $name the parked banner: $shown',
      ({ canManageBilling, shown }) => {
        arrange({ hasParkedBillingOperation: true, canManageBilling })

        expect(screen.queryByTestId('billing-parked-banner') !== null).toBe(
          shown
        )
      }
    )

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
    expect(screen.getByRole('link', { name: 'Manage' })).toBeInTheDocument()
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
    expect(within(plan).getByRole('link', { name: 'Manage' })).toHaveClass(
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

  it('replaces Manage with Contact sales when plan_kind is sales_managed', () => {
    arrange({ planKind: 'sales_managed', canOpenPlans: false })

    const link = screen.getByRole('link', { name: 'Contact sales' })
    expect(link).toHaveAttribute('href', 'https://comfy.org/contact/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
    expect(link).toHaveClass('no-underline')
    expect(
      screen.queryByRole('link', { name: 'Manage' })
    ).not.toBeInTheDocument()
  })

  it.for([
    { subscriptionStatus: 'ended' as const, variant: 'inverted' },
    { subscriptionStatus: 'canceled' as const, variant: 'secondary' },
    { subscriptionStatus: 'active' as const, variant: 'secondary' }
  ])(
    'renders Contact sales as $variant when subscription_status is $subscriptionStatus',
    ({ subscriptionStatus, variant }) => {
      arrange({ planKind: 'sales_managed', subscriptionStatus })

      expect(
        screen.getByRole('link', { name: 'Contact sales' })
      ).toHaveAttribute('data-variant', variant)
    }
  )

  it.for([
    {
      case: 'a served renewal date',
      renewalDate: '2027-10-28T00:00:00Z',
      line: 'Billed by contract. Renews October 28, 2027.'
    },
    {
      case: 'no renewal date',
      renewalDate: null,
      line: 'Billed by contract.'
    }
  ])(
    'shows an active sales-managed plan as Enterprise with $case',
    ({ renewalDate, line }) => {
      arrange({
        planKind: 'sales_managed',
        canOpenPlans: false,
        subscription: {
          ...activeSubscription,
          tier: 'ENTERPRISE',
          duration: 'ANNUAL',
          renewalDate
        }
      })

      expect(
        screen.getByRole('heading', { name: 'Enterprise' })
      ).toBeInTheDocument()
      expect(screen.getByTestId('billing-plan-line').textContent.trim()).toBe(
        line
      )
      expect(
        screen.getByRole('link', { name: 'Contact sales' })
      ).toHaveAttribute('href', 'https://comfy.org/contact/')
    }
  )

  it('picks the contract-billing row by plan_kind and keeps the served plan name on a PRO tier', () => {
    arrange({ planKind: 'sales_managed', canOpenPlans: false })

    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByTestId('billing-plan-line').textContent.trim()).toBe(
      'Billed by contract. Renews November 15.'
    )
  })

  it.for([
    { name: 'Manage', scenario: {} },
    {
      name: 'Subscribe',
      scenario: { subscription: null, subscriptionStatus: null }
    },
    {
      name: 'Choose a plan',
      scenario: {
        subscription: {
          ...activeSubscription,
          isActive: false,
          endDate: '2026-09-01T00:00:00Z'
        },
        subscriptionStatus: 'ended'
      }
    }
  ] satisfies { name: string; scenario: Scenario }[])(
    'opens $name on the billing site Plans page in a new tab',
    async ({ name, scenario }) => {
      arrange(scenario)

      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute(
        'href',
        expect.stringMatching(
          /^https:\/\/platform\.test\/profile\/billing\/plans\?workspace=ws_1&correlation_id=.+$/
        )
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toContainHTML('icon-[lucide--arrow-up-right]')
      link.addEventListener('click', (event) => event.preventDefault())

      await userEvent.click(link)

      expect(vi.mocked(useTelemetry)()?.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'platform_handoff',
          target: 'plans'
        })
      )
      expect(
        useSubscriptionPaywall().showSubscriptionDialog
      ).not.toHaveBeenCalled()
    }
  )

  it('hides the plan action when the server does not grant it', () => {
    arrange({ canOpenPlans: false })

    expect(
      screen.queryByRole('link', { name: 'Manage' })
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

  it('tells an owner the rest of billing lives on the linked platform.comfy.org', () => {
    arrange({ canManageBilling: true })

    const card = screen.getByTestId('billing-handoff-card')
    expect(
      within(card).getByText(/Manage everything else about billing on/)
    ).toBeInTheDocument()
    const platformLink = within(card).getByRole('link', {
      name: 'platform.comfy.org'
    })
    expect(platformLink).toHaveClass('underline')
    expect(platformLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://platform.test/profile/billing?')
    )
  })

  it('gives a member no platform.comfy.org line or link', () => {
    arrange({ canManageBilling: false })

    const card = screen.getByTestId('billing-handoff-card')
    expect(
      within(card).queryByText(/Manage everything else about billing on/)
    ).not.toBeInTheDocument()
    expect(
      within(card).queryByRole('link', { name: 'platform.comfy.org' })
    ).not.toBeInTheDocument()
  })

  it('links Partner Nodes pricing to the docs and messages support from the footer', async () => {
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'en'
    onTestFinished(() => {
      i18n.global.locale.value = previousLocale
    })
    arrange()
    const footer = screen.getByTestId('billing-footer')

    expect(
      within(footer).getByRole('link', { name: 'Partner Nodes pricing' })
    ).toHaveAttribute(
      'href',
      'https://docs.comfy.org/tutorials/partner-nodes/pricing'
    )
    await userEvent.click(
      within(footer).getByRole('button', { name: 'Message support' })
    )
    expect(handleMessageSupport).toHaveBeenCalledOnce()
  })

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

    it('confirms that the current plan stays, with no amount', async () => {
      await openStay()

      const dialog = screen.getByRole('dialog', {
        name: 'Cancel your change to Creator?'
      })
      expect(dialog).toHaveTextContent(
        "You'll stay on Pro. You can schedule a change again anytime."
      )
      expect(dialog).not.toHaveTextContent('$')
    })

    it('reverts the scheduled change and rereads status when confirmed', async () => {
      const { fetchStatus, refresh } = await openStay()
      fetchStatus.mockClear()

      await userEvent.click(screen.getByRole('button', { name: 'Stay on Pro' }))

      expect(billingApi.revertScheduledChange).toHaveBeenCalledOnce()
      expect(fetchStatus).toHaveBeenCalled()
      expect(refresh).toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    describe('when the server accepts the revert as pending', () => {
      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        vi.mocked(billingApi.revertScheduledChange).mockResolvedValueOnce({
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
        vi.mocked(billingApi.getBillingOpStatus)
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

        expect(billingApi.getBillingOpStatus).toHaveBeenCalledWith('op-revert')
        expect(fetchStatus).toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      const pollRejection = new WorkspaceApiError('Gateway timeout', 504)

      it.for([
        {
          outcome: 'the operation fails',
          arrangePoll: () =>
            vi.mocked(billingApi.getBillingOpStatus).mockResolvedValueOnce({
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
              .mocked(billingApi.getBillingOpStatus)
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
      vi.mocked(billingApi.revertScheduledChange).mockRejectedValueOnce(
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
      vi.mocked(billingApi.revertScheduledChange).mockRejectedValueOnce(
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

    it('offers Manage on the billing site after Resume plan', () => {
      arrange(ending)

      const row = screen.getByTestId('billing-plan-row')
      const resume = within(row).getByRole('button', { name: 'Resume plan' })
      const manage = within(row).getByRole('link', { name: 'Manage' })
      expect(manage).toHaveAttribute(
        'href',
        expect.stringContaining(
          'https://platform.test/profile/billing/plans?workspace=ws_1'
        )
      )
      expect(
        resume.compareDocumentPosition(manage) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it('offers no plan button to a member of an ending plan', () => {
      arrange({
        ...ending,
        canReactivate: false,
        canOpenPlans: false,
        canManageSubscription: false,
        canManageBilling: false
      })

      expect(
        within(screen.getByTestId('billing-plan-row')).queryAllByRole('link')
      ).toEqual([])
      expect(
        within(screen.getByTestId('billing-plan-row')).queryAllByRole('button')
      ).toEqual([])
    })

    describe('plan lifecycle banner on Cloud', () => {
      beforeEach(() => {
        distribution.isCloud = true
      })
      afterEach(() => {
        distribution.isCloud = false
      })

      function arrangeOnCloud(scenario: Scenario) {
        vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
        arrange(scenario)
      }

      it('shows Plan ending with the plan row keeping the actions', () => {
        arrangeOnCloud(ending)

        const banner = screen.getByRole('status')
        expect(banner).toHaveTextContent(
          'Your Pro plan ends on October 28, 2026'
        )
        expect(within(banner).queryAllByRole('button')).toEqual([])
        expect(
          screen.getByRole('button', { name: 'Resume plan' })
        ).toBeInTheDocument()
      })

      it('shows no lifecycle banner on an active plan', () => {
        arrangeOnCloud({})

        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })
    })

    it('hides Resume when the server withholds can_reactivate', () => {
      arrange({ ...ending, canReactivate: false })

      expect(
        screen.queryByRole('button', { name: 'Resume plan' })
      ).not.toBeInTheDocument()
    })
  })

  it('shows a paused plan by name with the paused line', () => {
    arrange({ billingStatus: 'paused' })

    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument()
    expect(screen.getByTestId('billing-plan-line')).toHaveTextContent(
      "Paused. The renewal payment didn't go through."
    )
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

    expect(
      vi.mocked(useTelemetry)()?.trackAddApiCreditButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({ source: 'credits_panel' })
    expect(useBillingDialogs().showTopUpCreditsDialog).toHaveBeenCalledWith({
      source: 'settings_billing_panel'
    })
  })

  describe('Top-up checkout banner', () => {
    function servedCheckouts(...checkouts: HostedTopupCheckout[]) {
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
        checkouts: checkouts.map(({ session_id, amount_cents }) => ({
          session_id,
          amount_cents,
          created_at: '2026-10-20T00:00:00Z'
        })),
        next_cursor: null
      })
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
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

        const banner = await screen.findByTestId(
          'billing-topup-checkout-banner'
        )
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
        arrange()

        const banner = await screen.findByTestId(
          'billing-topup-checkout-banner'
        )
        expect(banner).toHaveTextContent(title)
        expect(banner).toHaveTextContent(
          'No credits were added. Try again or use a different payment method.'
        )
        await userEvent.click(
          within(banner).getByRole('button', { name: 'Add credits' })
        )
        expect(
          vi.mocked(useTelemetry)()?.trackAddApiCreditButtonClicked
        ).toHaveBeenCalledExactlyOnceWith({
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

      const banner = await screen.findByTestId('billing-topup-checkout-banner')
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

    function addCreditsVariants() {
      return screen
        .getAllByRole('button', { name: 'Add credits' })
        .map((button) => button.getAttribute('data-variant'))
    }

    it('turns Add credits white in the out-of-credits banner and the Credits card when auto top-up is off', async () => {
      vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
      arrange({
        balance: zeroBalance,
        subscription: { ...activeSubscription, hasFunds: false }
      })

      await screen.findByTestId('billing-auto-top-up-status')
      expect(
        within(screen.getByTestId('billing-local-credit-banner')).getByRole(
          'button',
          { name: 'Add credits' }
        )
      ).toHaveAttribute('data-variant', 'inverted')
      expect(addCreditsVariants()).toEqual(['inverted', 'inverted'])
    })

    it('turns Add credits white at 0 while a top-up payment is processing and auto top-up is off', async () => {
      servedCheckouts(checkout('payment_processing'))
      arrange({ balance: zeroBalance })

      await screen.findByTestId('billing-topup-checkout-banner')
      await screen.findByTestId('billing-auto-top-up-status')
      expect(
        within(screen.getByTestId('billing-credits-card')).getByRole('button', {
          name: 'Add credits'
        })
      ).toHaveAttribute('data-variant', 'inverted')
    })

    it('keeps Add credits grey at 0 when the served auto top-up status will refill', async () => {
      const served = await billingApi.getBillingAutoReload()
      vi.mocked(billingApi.getBillingAutoReload).mockResolvedValue({
        ...served,
        configured: true,
        enabled: true,
        status: 'on'
      })
      vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
      arrange({
        balance: zeroBalance,
        subscription: { ...activeSubscription, hasFunds: false }
      })

      await screen.findByTestId('billing-auto-top-up-status')
      expect(addCreditsVariants()).toEqual(['secondary', 'secondary'])
    })

    it('keeps Subscribe the one white button with no plan at 0', () => {
      arrange({
        balance: zeroBalance,
        subscription: null,
        subscriptionStatus: null
      })

      expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute(
        'data-variant',
        'inverted'
      )
      expect(addCreditsVariants()).toEqual(['secondary'])
    })

    it('offers no Add credits on a failed top-up when the server withholds can_top_up', async () => {
      servedCheckouts(checkout('failed'))
      arrange({ canTopUp: false })

      const banner = await screen.findByTestId('billing-topup-checkout-banner')
      expect(
        within(banner).queryByRole('button', { name: 'Add credits' })
      ).not.toBeInTheDocument()
    })

    it('reveals the processing payment once the failed top-up is dismissed', async () => {
      servedCheckouts(checkout('failed'), checkout('payment_processing'))
      arrange()

      const banner = await screen.findByTestId('billing-topup-checkout-banner')
      await userEvent.click(
        within(banner).getByRole('button', { name: 'Dismiss' })
      )

      expect(
        screen.getByTestId('billing-topup-checkout-banner')
      ).toHaveTextContent('Payment processing')
    })

    it('clears the credits banner when a fulfilled read is still in flight at the next refresh', async () => {
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_1',
            amount_cents: 2500,
            created_at: '2026-10-20T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      const settleDetail: Array<(checkout: HostedTopupCheckout) => void> = []
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
        () =>
          new Promise((resolve) => {
            settleDetail.push(resolve)
          })
      )
      arrange({ autoTopUpFlag: false })

      await vi.waitFor(() => expect(settleDetail).toHaveLength(1))
      settleDetail[0](checkout('credits_applying', { session_id: 'cs_1' }))
      await screen.findByTestId('billing-topup-checkout-banner')

      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(settleDetail).toHaveLength(2))

      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      visibility.mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      visibility.mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      await vi.advanceTimersByTimeAsync(5_000)

      expect(settleDetail).toHaveLength(2)
      settleDetail[1](checkout('fulfilled', { session_id: 'cs_1' }))

      await vi.waitFor(() =>
        expect(
          screen.queryByTestId('billing-topup-checkout-banner')
        ).not.toBeInTheDocument()
      )
    })

    it('refetches once a pending read settles when the tab becomes visible meanwhile', async () => {
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_1',
            amount_cents: 2500,
            created_at: '2026-10-20T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      const settleDetail: Array<(checkout: HostedTopupCheckout) => void> = []
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
        () =>
          new Promise((resolve) => {
            settleDetail.push(resolve)
          })
      )
      arrange({ autoTopUpFlag: false })
      await vi.waitFor(() => expect(settleDetail).toHaveLength(1))

      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      visibility.mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      visibility.mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      expect(settleDetail).toHaveLength(1)

      settleDetail[0](checkout('payment_processing', { session_id: 'cs_1' }))
      await screen.findByTestId('billing-topup-checkout-banner')
      await vi.waitFor(() => expect(settleDetail).toHaveLength(2))
      settleDetail[1](checkout('fulfilled', { session_id: 'cs_1' }))

      await vi.waitFor(() =>
        expect(
          screen.queryByTestId('billing-topup-checkout-banner')
        ).not.toBeInTheDocument()
      )
    })

    it('clears the credits banner on its own once the server reports fulfilled', async () => {
      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      arrange()
      await screen.findByTestId('billing-topup-checkout-banner')

      servedCheckouts(checkout('fulfilled', { session_id: 'cs_1' }))
      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(
          screen.queryByTestId('billing-topup-checkout-banner')
        ).not.toBeInTheDocument()
      )
    })

    it('keeps other checkouts visible when one session read fails', async () => {
      const unavailable = new WorkspaceApiError('Bad gateway', 502)
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
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
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
        async (sessionId) => {
          if (sessionId === 'cs_unreadable') throw unavailable
          return checkout('payment_processing')
        }
      )
      arrange()

      expect(
        await screen.findByTestId('billing-topup-checkout-banner')
      ).toHaveTextContent('Payment processing')
      expect(reportError).toHaveBeenCalledWith(
        unavailable,
        expect.objectContaining({ errorType: 'topup_checkout_read_failed' })
      )
    })

    it('keeps Payment received and keeps polling when a credits_applying read fails once', async () => {
      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      arrange()
      await screen.findByTestId('billing-topup-checkout-banner')

      vi.mocked(billingApi.getTopupCheckout).mockRejectedValueOnce(
        new WorkspaceApiError('Bad gateway', 502)
      )
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
      vi.mocked(billingApi.getTopupCheckout).mockClear()
      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(billingApi.getTopupCheckout).toHaveBeenCalledWith('cs_1')
      )
      expect(
        screen.getByTestId('billing-topup-checkout-banner')
      ).toHaveTextContent('Payment received')
    })

    it('drops a checkout read that started in the previous workspace', async () => {
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [
          {
            session_id: 'cs_a',
            amount_cents: 2500,
            created_at: '2026-10-20T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      const settleDetail: Array<(checkout: HostedTopupCheckout) => void> = []
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
        () =>
          new Promise((resolve) => {
            settleDetail.push(resolve)
          })
      )
      arrange({ autoTopUpFlag: false })
      await vi.waitFor(() => expect(settleDetail).toHaveLength(1))

      vi.mocked(billingApi.listTopupCheckouts).mockClear()
      let settleWorkspaceBList: (
        listed: Awaited<ReturnType<typeof billingApi.listTopupCheckouts>>
      ) => void = () => {}
      vi.mocked(billingApi.listTopupCheckouts).mockReturnValueOnce(
        new Promise((resolve) => {
          settleWorkspaceBList = resolve
        })
      )
      activateBillingScope('actor-a', 'workspace-b')
      await nextTick()

      settleDetail[0](checkout('failed', { session_id: 'cs_a' }))
      await vi.waitFor(() =>
        expect(billingApi.listTopupCheckouts).toHaveBeenCalledOnce()
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(
        screen.queryByTestId('billing-topup-checkout-banner')
      ).not.toBeInTheDocument()

      vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
        checkout('payment_processing', { session_id: 'cs_b' })
      )
      settleWorkspaceBList({
        checkouts: [
          {
            session_id: 'cs_b',
            amount_cents: 2500,
            created_at: '2026-10-21T00:00:00Z'
          }
        ],
        next_cursor: null
      })
      expect(
        await screen.findByTestId('billing-topup-checkout-banner')
      ).toHaveTextContent('Payment processing')
    })

    it("clears the previous workspace's checkout banner on a workspace switch", async () => {
      servedCheckouts(checkout('payment_processing'))
      arrange()
      await screen.findByTestId('billing-topup-checkout-banner')

      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
        checkouts: [],
        next_cursor: null
      })
      activateBillingScope('actor-a', 'workspace-b')

      await vi.waitFor(() =>
        expect(
          screen.queryByTestId('billing-topup-checkout-banner')
        ).not.toBeInTheDocument()
      )
    })

    it('reports a failed checkout list and shows no banner', async () => {
      const unavailable = new WorkspaceApiError('Unavailable', 503)
      vi.mocked(billingApi.listTopupCheckouts).mockRejectedValue(unavailable)
      arrange()

      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          unavailable,
          expect.objectContaining({ errorType: 'topup_checkout_read_failed' })
        )
      )
      expect(
        screen.queryByTestId('billing-topup-checkout-banner')
      ).not.toBeInTheDocument()
    })

    it('keeps polling credits_applying after a newer failure takes the banner', async () => {
      servedCheckouts(
        checkout('failed', { session_id: 'cs_failed' }),
        checkout('credits_applying', { session_id: 'cs_applying' })
      )
      arrange()

      expect(
        await screen.findByTestId('billing-topup-checkout-banner')
      ).toHaveTextContent("Your $25 top-up didn't go through")
      vi.mocked(billingApi.getTopupCheckout).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(billingApi.getTopupCheckout).toHaveBeenCalledWith('cs_applying')
      )
    })

    it('reports one unreadable session once while credits are still applying', async () => {
      const unavailable = new WorkspaceApiError('Bad gateway', 502)
      vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
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
      vi.mocked(billingApi.getTopupCheckout).mockImplementation(
        async (sessionId) => {
          if (sessionId === 'cs_unreadable') throw unavailable
          return checkout('credits_applying', { session_id: 'cs_applying' })
        }
      )
      arrange()

      await screen.findByTestId('billing-topup-checkout-banner')
      expect(reportError).toHaveBeenCalledTimes(1)
      vi.mocked(reportError).mockClear()
      vi.mocked(billingApi.getTopupCheckout).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)

      await vi.waitFor(() =>
        expect(billingApi.getTopupCheckout).toHaveBeenCalledWith(
          'cs_unreadable'
        )
      )
      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports a checkout list failure once until a later read succeeds', async () => {
      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      arrange()
      await screen.findByTestId('billing-topup-checkout-banner')

      const unavailable = new WorkspaceApiError('Unavailable', 503)
      vi.mocked(billingApi.listTopupCheckouts).mockRejectedValue(unavailable)
      vi.mocked(reportError).mockClear()

      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(5_000)
      expect(reportError).toHaveBeenCalledTimes(1)

      servedCheckouts(checkout('credits_applying', { session_id: 'cs_1' }))
      vi.mocked(billingApi.getTopupCheckout).mockClear()
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() =>
        expect(billingApi.getTopupCheckout).toHaveBeenCalled()
      )

      vi.mocked(billingApi.listTopupCheckouts).mockRejectedValue(unavailable)
      await vi.advanceTimersByTimeAsync(5_000)
      await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(2))
    })

    it('never reads checkouts for a member without can_manage_billing', () => {
      servedCheckouts(checkout('payment_processing'))
      arrange({ canManageBilling: false })

      expect(billingApi.listTopupCheckouts).not.toHaveBeenCalled()
      expect(
        screen.queryByTestId('billing-topup-checkout-banner')
      ).not.toBeInTheDocument()
    })
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
      expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(reads)
    })

    it('reads the auto top-up settings once for the card and the banner', async () => {
      arrange({})
      await screen.findByTestId('billing-auto-top-up-status')

      expect(billingApi.getBillingAutoReload).toHaveBeenCalledTimes(1)
    })
  })
})

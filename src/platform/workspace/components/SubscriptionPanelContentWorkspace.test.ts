import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BillingType, SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json'
import * as tierPricing from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  Plan,
  TeamCreditStops,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionPanelContentWorkspace from './SubscriptionPanelContentWorkspace.vue'

const { mockIsSettingUp, mockSubscriptionActionOperation } = vi.hoisted(() => ({
  mockIsSettingUp: { value: false },
  mockSubscriptionActionOperation: {
    value: undefined as { actionUrl: string } | undefined
  }
}))
const mockDistributionState = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: mockShouldUseWorkspaceBilling
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

const RENEWAL_DATE_ISO = '2026-06-20T12:00:00Z'
const END_DATE_ISO = '2026-01-20T12:00:00Z'

function formatPanelDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// The panel displays the subscribed credit stop's per-month price; monthly and
// yearly stops are both per-month figures.
const teamCreditStops: TeamCreditStops = {
  default_stop_index: 1,
  stops: [
    {
      id: 'team_700',
      credits: 147700,
      monthly: { list_price_cents: 70000, price_cents: 66500 },
      yearly: { list_price_cents: 70000, price_cents: 63000 }
    },
    {
      id: 'team_2500',
      credits: 527500,
      monthly: { list_price_cents: 250000, price_cents: 225000 },
      yearly: { list_price_cents: 250000, price_cents: 200000 }
    }
  ]
}

const mockSubscriptionStatus = ref<BillingSubscriptionStatus>('active')
const mockBillingStatus = ref<BillingStatus>('paid')
const mockBillingType = ref<BillingType>('workspace')
const mockSubscriptionDuration = ref<'MONTHLY' | 'ANNUAL'>('MONTHLY')
const mockRenewalDate = ref<string | null>(RENEWAL_DATE_ISO)
const mockEndDate = ref<string | null>(END_DATE_ISO)
const mockScheduledPlanSlug = ref<string | null>(null)
const mockChangeAt = ref<string | null>(null)
const mockHasSubscription = ref(true)
const mockIsActiveSubscription = ref(true)
const mockIsInPersonalWorkspace = ref(false)
const mockIsWorkspaceSubscribed = ref(true)
const mockCanManageSubscription = ref(true)
const mockCanManageSubscriptionLifecycle = ref(true)
const mockCanCancel = ref(true)
const mockCanReactivate = ref(true)
const mockCanReactivatePlan = ref(true)
const mockCanOpenPricingSurface = ref(true)
const mockShouldUseWorkspaceBilling = ref(true)
const mockCanChangeSeats = ref(true)
const mockCanSubscribeSelfServe = ref(true)
const mockCanLeaveWorkspace = ref(true)
const mockTeamCreditStops = ref<TeamCreditStops | null>(teamCreditStops)
const mockCurrentTeamCreditStop = ref<TeamCreditStopSummary | null>({
  id: 'team_700',
  credits_monthly: 147700,
  stop_usd: 700
})

const mockManageSubscription = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockResubscribe = vi.fn()
const mockShowLeaveWorkspaceDialog = vi.fn()
const mockShowCancelSubscriptionFlow = vi.fn()
const mockShowEditWorkspaceDialog = vi.fn()
const mockShowDeleteWorkspaceDialog = vi.fn()

type MenuUiConfig = {
  showEditWorkspaceMenuItem: boolean
  workspaceMenuAction: 'delete' | null
  workspaceMenuDisabledTooltip: string | null
}

const ownerUiConfig: MenuUiConfig = {
  showEditWorkspaceMenuItem: true,
  workspaceMenuAction: 'delete',
  workspaceMenuDisabledTooltip:
    'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
}
const memberUiConfig: MenuUiConfig = {
  showEditWorkspaceMenuItem: false,
  workspaceMenuAction: null,
  workspaceMenuDisabledTooltip: null
}
const personalUiConfig: MenuUiConfig = {
  showEditWorkspaceMenuItem: true,
  workspaceMenuAction: null,
  workspaceMenuDisabledTooltip: null
}
const mockUiConfig = ref<MenuUiConfig>(ownerUiConfig)

const mockSubscriptionTier = ref<SubscriptionInfo['tier']>('PRO')
const mockPlanSlug = ref('team-monthly')
const mockHasTeamPlan = ref(true)
const mockPlans = ref<Plan[]>([
  {
    slug: 'pro-annual',
    tier: 'PRO',
    duration: 'ANNUAL',
    price_cents: 96000,
    credits_cents: 253200,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 96000,
      total_credits_cents: 253200
    }
  }
])

const mockSubscription = computed<SubscriptionInfo | null>(() =>
  mockHasSubscription.value
    ? {
        isActive: true,
        tier: mockSubscriptionTier.value,
        duration: mockSubscriptionDuration.value,
        planSlug: mockPlanSlug.value,
        scheduledPlanSlug: mockScheduledPlanSlug.value,
        changeAt: mockChangeAt.value,
        renewalDate: mockRenewalDate.value,
        endDate: mockEndDate.value,
        isCancelled: mockSubscriptionStatus.value === 'canceled',
        hasFunds: true
      }
    : null
)
const mockIsTeamPlan = computed(
  () => mockHasSubscription.value && mockHasTeamPlan.value
)

const mockInitialize = vi.fn()
const mockIsLoading = ref(false)
const mockError = ref<string | null>(null)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    type: mockBillingType,
    canAccessSubscriptionFeatures: computed(
      () => mockIsActiveSubscription.value
    ),
    isFreeTier: computed(() => mockSubscriptionTier.value === 'FREE'),
    billingStatus: mockBillingStatus,
    subscriptionStatus: mockSubscriptionStatus,
    isTeamPlan: mockIsTeamPlan,
    subscription: mockSubscription,
    plans: mockPlans,
    teamCreditStops: mockTeamCreditStops,
    currentTeamCreditStop: mockCurrentTeamCreditStop,
    isLoading: mockIsLoading,
    error: mockError,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    manageSubscription: mockManageSubscription,
    resubscribe: mockResubscribe,
    initialize: mockInitialize,
    getMaxSeats: () => 5
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed
  })
}))

const mockIsTeamPlanCancelled = computed(
  () => mockHasTeamPlan.value && (mockSubscription.value?.isCancelled ?? false)
)
const mockIsSubscriptionCancelled = computed(
  () => mockSubscription.value?.isCancelled ?? false
)

const mockIsDeleteDisabled = computed(
  () =>
    mockIsActiveSubscription.value &&
    !(mockSubscription.value?.isCancelled ?? false)
)

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value,
      canManageSubscriptionLifecycle: mockCanManageSubscriptionLifecycle.value,
      canLeaveWorkspace: mockCanLeaveWorkspace.value
    })),
    canReactivatePlan: mockCanReactivatePlan,
    canOpenPricingSurface: mockCanOpenPricingSurface,
    uiConfig: computed(() => mockUiConfig.value),
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    isActiveSubscription: computed(() => mockIsActiveSubscription.value),
    isSubscriptionCancelled: mockIsSubscriptionCancelled,
    isTeamPlanCancelled: mockIsTeamPlanCancelled,
    isDeleteDisabled: mockIsDeleteDisabled,
    deleteDisabledTooltipKey: computed(() =>
      mockIsDeleteDisabled.value
        ? mockUiConfig.value.workspaceMenuDisabledTooltip
        : null
    )
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canCancel: mockCanCancel,
    canReactivate: mockCanReactivate,
    canChangeSeats: mockCanChangeSeats,
    canSubscribeSelfServe: mockCanSubscribeSelfServe
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    get isSettingUp() {
      return mockIsSettingUp.value
    },
    get subscriptionActionOperation() {
      return mockSubscriptionActionOperation.value
    }
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCancelSubscriptionFlow: mockShowCancelSubscriptionFlow,
    showLeaveWorkspaceDialog: mockShowLeaveWorkspaceDialog,
    showEditWorkspaceDialog: mockShowEditWorkspaceDialog,
    showDeleteWorkspaceDialog: mockShowDeleteWorkspaceDialog
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: vi.fn() })
  })
)

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const CreditsTileStub = {
  props: ['zeroState', 'inactivePlan'],
  template:
    '<div data-testid="credits-tile" :data-zero-state="String(zeroState)" :data-inactive-plan="String(inactivePlan)" />'
}

const ButtonStub = {
  template:
    '<button v-bind="$attrs" :disabled="loading" @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['variant', 'size', 'loading'],
  emits: ['click']
}

const SubscriptionFooterLinksStub = {
  props: ['showInvoiceHistory'],
  template:
    '<div data-testid="subscription-footer-links" :data-show-invoice-history="String(showInvoiceHistory)" />'
}

const DropdownMenuStub = {
  props: ['entries'],
  template:
    '<div data-testid="plan-menu"><slot name="button" /><button v-for="item in (entries || []).filter((e) => !e.separator)" :key="item.label" type="button" :disabled="item.disabled" @click="item.command?.({})">{{ item.label }}</button></div>'
}

function renderComponent({ stubFooter = true } = {}) {
  return render(SubscriptionPanelContentWorkspace, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      directives: { tooltip: {} },
      stubs: {
        CreditsTile: CreditsTileStub,
        Button: ButtonStub,
        ...(stubFooter
          ? { SubscriptionFooterLinks: SubscriptionFooterLinksStub }
          : {}),
        StatusBadge: true,
        DropdownMenu: DropdownMenuStub
      }
    }
  })
}

describe('SubscriptionPanelContentWorkspace', () => {
  beforeEach(() => {
    mockDistributionState.isCloud = true
    mockSubscriptionStatus.value = 'active'
    mockBillingStatus.value = 'paid'
    mockBillingType.value = 'workspace'
    mockRenewalDate.value = RENEWAL_DATE_ISO
    mockEndDate.value = END_DATE_ISO
    mockScheduledPlanSlug.value = null
    mockChangeAt.value = null
    mockHasSubscription.value = true
    mockIsActiveSubscription.value = true
    mockIsInPersonalWorkspace.value = false
    mockIsWorkspaceSubscribed.value = true
    mockCanManageSubscription.value = true
    mockCanManageSubscriptionLifecycle.value = true
    mockCanCancel.value = true
    mockCanReactivate.value = true
    mockCanReactivatePlan.value = true
    mockShouldUseWorkspaceBilling.value = true
    mockCanChangeSeats.value = true
    mockCanSubscribeSelfServe.value = true
    mockCanOpenPricingSurface.value = true
    mockCanLeaveWorkspace.value = true
    mockUiConfig.value = ownerUiConfig
    mockSubscriptionTier.value = 'PRO'
    mockPlanSlug.value = 'team-monthly'
    mockHasTeamPlan.value = true
    mockSubscriptionDuration.value = 'MONTHLY'
    mockTeamCreditStops.value = teamCreditStops
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147700,
      stop_usd: 700
    }
    mockIsLoading.value = false
    mockError.value = null
    mockIsSettingUp.value = false
    mockSubscriptionActionOperation.value = undefined
  })

  it('keeps verification available in settings without exposing its URL', async () => {
    const actionUrl = 'https://verify.example/sensitive-token'
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    mockIsSettingUp.value = true
    mockSubscriptionActionOperation.value = { actionUrl }
    const { container } = renderComponent()

    expect(open).not.toHaveBeenCalled()
    expect(container.innerHTML).not.toContain(actionUrl)
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )
    expect(open).toHaveBeenCalledWith(
      actionUrl,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('hides verification from users without billing permission', () => {
    mockIsSettingUp.value = true
    mockCanManageSubscription.value = false
    mockCanChangeSeats.value = false
    mockCanSubscribeSelfServe.value = false
    mockSubscriptionActionOperation.value = {
      actionUrl: 'https://verify.example/sensitive-token'
    }

    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
  })

  it('renders the subscribed credit stop price and renewal subtitle', () => {
    renderComponent()

    expect(screen.getByText('Team')).toBeInTheDocument()
    // Monthly subscription on team_700 -> monthly.price_cents 66500 -> $665.
    expect(screen.getByText('$665')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.queryByText('USD / mo / member')).not.toBeInTheDocument()
    expect(
      screen.getByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(screen.getByTestId('subscription-footer-links')).toBeInTheDocument()
    expect(screen.getByTestId('subscription-footer-links')).toHaveAttribute(
      'data-show-invoice-history',
      'true'
    )
  })

  describe('sales-managed tiers (FE-1662)', () => {
    const runtimeTier = (tier: string) =>
      tier as unknown as SubscriptionInfo['tier']

    // Mirrors billing-api hideLifecycleCapabilities: lifecycle actions and the
    // self-serve catalog close, credit top-up stays open.
    function useSalesManagedCapabilities() {
      mockCanCancel.value = false
      mockCanReactivate.value = false
      mockCanReactivatePlan.value = false
      mockCanChangeSeats.value = false
      mockCanSubscribeSelfServe.value = false
      mockCanOpenPricingSurface.value = false
    }

    function useEnterprisePlan() {
      mockHasTeamPlan.value = false
      mockSubscriptionTier.value = 'ENTERPRISE'
      mockPlanSlug.value = 'enterprise_monthly'
      mockCurrentTeamCreditStop.value = null
      useSalesManagedCapabilities()
    }

    it('renders Enterprise without price, benefits, or a plan-change action', () => {
      useEnterprisePlan()
      renderComponent()

      expect(screen.getByText('Enterprise')).toBeInTheDocument()
      expect(screen.queryByText('$665')).not.toBeInTheDocument()
      expect(screen.queryByText('USD / mo')).not.toBeInTheDocument()
      expect(screen.queryByText('Your plan includes:')).not.toBeInTheDocument()
      expect(
        screen.queryByText('View more details about plans & pricing')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /change plan|upgrade plan/i })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
      ).toBeInTheDocument()
    })

    it('keeps Billing & invoices open on an Enterprise plan', () => {
      useEnterprisePlan()
      renderComponent()

      expect(
        screen.getByRole('button', { name: 'Billing & invoices' })
      ).toBeInTheDocument()
    })

    it('hides Reactivate for a cancelled Enterprise plan', () => {
      useEnterprisePlan()
      mockSubscriptionStatus.value = 'canceled'
      renderComponent()

      expect(
        screen.queryByRole('button', { name: /reactivate/i })
      ).not.toBeInTheDocument()
    })

    it('offers no subscribe or reactivate path for an ended Enterprise plan', () => {
      useEnterprisePlan()
      mockSubscriptionStatus.value = 'ended'
      mockIsActiveSubscription.value = false
      renderComponent()

      expect(screen.getByText('Enterprise')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /subscribe|reactivate/i })
      ).not.toBeInTheDocument()
    })

    it('renders an unrecognized tier as Current plan without catalog content', () => {
      mockHasTeamPlan.value = false
      mockSubscriptionTier.value = runtimeTier('GALACTIC')
      mockPlanSlug.value = 'galactic_monthly'
      mockCurrentTeamCreditStop.value = null
      useSalesManagedCapabilities()
      renderComponent()

      expect(screen.getByText('Current plan')).toBeInTheDocument()
      expect(screen.queryByText('$665')).not.toBeInTheDocument()
      expect(screen.queryByText('USD / mo')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /change plan|upgrade plan/i })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
      ).toBeInTheDocument()
    })

    it('labels a scheduled change to Enterprise outside the self-serve catalog', () => {
      mockScheduledPlanSlug.value = 'enterprise_monthly'
      mockChangeAt.value = END_DATE_ISO
      renderComponent()

      expect(
        screen.getByText(
          `Changes to Enterprise on ${formatPanelDate(END_DATE_ISO)}`
        )
      ).toBeInTheDocument()
    })
  })

  it('shows a scheduled plan change instead of the renewal date', () => {
    mockScheduledPlanSlug.value = 'pro-annual'
    mockChangeAt.value = END_DATE_ISO
    renderComponent()

    expect(
      screen.getByText(`Changes to Pro on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Renews on/i)).not.toBeInTheDocument()
  })

  it('does not show an incomplete scheduled plan change', () => {
    mockScheduledPlanSlug.value = 'missing-plan'
    mockChangeAt.value = END_DATE_ISO
    renderComponent()

    expect(screen.queryByText(/^Changes to/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Renews on/i)).not.toBeInTheDocument()
  })

  it.for([null, 'not-a-date', '2026-02-31T12:00:00Z'])(
    'omits renewal copy when the active renewal date is %s',
    (renewalDate) => {
      mockRenewalDate.value = renewalDate
      renderComponent()

      expect(screen.queryByText(/^Renews on/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
    }
  )

  it('uses the yearly stop price for an annual subscription, still shown per month', () => {
    mockSubscriptionDuration.value = 'ANNUAL'
    mockCurrentTeamCreditStop.value = {
      id: 'team_2500',
      credits_monthly: 527500,
      stop_usd: 2500
    }
    renderComponent()

    // team_2500 yearly.price_cents 200000 -> $2,000, labelled per month.
    expect(screen.getByText('$2,000')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
  })

  it('falls back to the per-member tier price until stops resolve', () => {
    mockTeamCreditStops.value = null
    mockCurrentTeamCreditStop.value = null
    renderComponent()

    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('USD / mo / member')).toBeInTheDocument()
  })

  it('falls back to the per-member price when the subscribed stop id is stale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockCurrentTeamCreditStop.value = {
      id: 'team_unknown',
      credits_monthly: 1,
      stop_usd: 1
    }
    renderComponent()

    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('USD / mo / member')).toBeInTheDocument()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('shows cents when the subscribed stop price is not a whole dollar', () => {
    mockTeamCreditStops.value = {
      default_stop_index: 0,
      stops: [
        {
          id: 'team_700',
          credits: 147700,
          monthly: { list_price_cents: 70000, price_cents: 66550 },
          yearly: { list_price_cents: 70000, price_cents: 63000 }
        }
      ]
    }
    renderComponent()

    expect(screen.getByText('$665.50')).toBeInTheDocument()
  })

  it('wires Billing & invoices and Change plan actions for subscription managers', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Change plan' }))
    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('hides Change plan when the server denies seat changes to a client-side owner', () => {
    mockCanManageSubscription.value = true
    mockCanChangeSeats.value = false
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Billing & invoices' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change plan' })
    ).not.toBeInTheDocument()
  })

  it('preserves local Manage billing and Invoice history actions', async () => {
    const user = userEvent.setup()
    mockDistributionState.isCloud = false
    renderComponent({ stubFooter: false })

    expect(
      screen.queryByRole('button', { name: 'Billing & invoices' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Manage billing' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Invoice history' }))
    expect(mockManageSubscription).toHaveBeenCalledTimes(2)
  })

  it('keeps a Personal workspace Team-plan member view read-only', () => {
    mockIsInPersonalWorkspace.value = true
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockCanCancel.value = false
    mockCanReactivate.value = false
    mockCanChangeSeats.value = false
    mockCanSubscribeSelfServe.value = false
    mockCanLeaveWorkspace.value = true
    mockUiConfig.value = memberUiConfig
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Billing & invoices' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change plan' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit workspace details' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
    expect(screen.getByText('Invite members')).toBeInTheDocument()
    expect(screen.getByTestId('subscription-footer-links')).toHaveAttribute(
      'data-show-invoice-history',
      'false'
    )
  })

  it('uses Team-plan change copy in a Personal workspace', () => {
    mockIsInPersonalWorkspace.value = true
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Change plan' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Upgrade plan' })
    ).not.toBeInTheDocument()
  })

  it('keeps billing access in the ended state for an inactive paid Personal workspace', async () => {
    const user = userEvent.setup()
    mockBillingType.value = 'legacy'
    mockIsInPersonalWorkspace.value = true
    mockIsActiveSubscription.value = false
    mockBillingStatus.value = 'inactive'
    renderComponent()

    expect(screen.getByText('Your subscription has ended')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Subscribe' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Team' })
    ).not.toBeInTheDocument()
  })

  it('shows subscribe prompt for an ended Standard plan in a Team workspace', () => {
    mockSubscriptionStatus.value = 'ended'
    mockSubscriptionTier.value = 'STANDARD'
    mockPlanSlug.value = 'standard-monthly'
    mockHasTeamPlan.value = false
    renderComponent()

    expect(
      screen.getByRole('heading', {
        name: 'This workspace is not on a subscription'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe Now' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Standard' })
    ).not.toBeInTheDocument()
  })

  it.for(['paid', 'payment_failed', 'paused'] as BillingStatus[])(
    'keeps billing access for a non-terminal %s personal plan',
    (billingStatus) => {
      mockIsInPersonalWorkspace.value = true
      mockIsActiveSubscription.value = false
      mockBillingStatus.value = billingStatus
      renderComponent()

      expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
      expect(
        screen.queryByText('Your subscription has ended')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Subscribe' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Billing & invoices' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Change plan' })
      ).not.toBeInTheDocument()
    }
  )

  it('shows dated cancellation copy while a cancelled plan remains active', async () => {
    const user = userEvent.setup()
    mockSubscriptionStatus.value = 'canceled'
    mockScheduledPlanSlug.value = 'pro-annual'
    mockChangeAt.value = RENEWAL_DATE_ISO
    mockCanLeaveWorkspace.value = false
    renderComponent()

    expect(
      screen.getByText(
        `You won't be charged again. Your features remain active until ${formatPanelDate(END_DATE_ISO)}.`
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(`Ends on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^Changes to/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Billing & invoices' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change plan' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reactivate plan' }))
    expect(mockResubscribe).toHaveBeenCalledOnce()
    expect(mockShowSubscriptionDialog).not.toHaveBeenCalled()
  })

  it('shows ended copy for an inactive ended subscription without a date', () => {
    mockSubscriptionStatus.value = 'ended'
    mockIsActiveSubscription.value = false
    mockIsInPersonalWorkspace.value = true
    mockEndDate.value = null
    renderComponent()

    expect(screen.getByText('Your subscription has ended')).toBeInTheDocument()
    expect(
      screen.getByText('Your subscription is no longer active.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/features remain active/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/^Ends on/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe' })
    ).toBeInTheDocument()
  })

  it('preserves local inactive Team billing and invoice actions', async () => {
    const user = userEvent.setup()
    mockDistributionState.isCloud = false
    mockSubscriptionStatus.value = 'canceled'
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    renderComponent({ stubFooter: false })

    expect(
      screen.getByRole('heading', { name: 'Inactive team subscription' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Invoice history' }))
    expect(mockManageSubscription).toHaveBeenCalledTimes(2)
  })

  it('renders an ended Team plan for its owner and routes reactivation to checkout', async () => {
    mockSubscriptionStatus.value = 'canceled'
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByText('Your subscription has ended')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Inactive team subscription' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Reactivate your team plan to add more members and run workflows'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Billing & invoices' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivate plan' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More Options' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-zero-state',
      'true'
    )
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-inactive-plan',
      'true'
    )
    expect(document.body.textContent).toContain(
      'An active plan features everything in Pro, plus:'
    )
    expect(screen.getByText('Invite members')).toBeInTheDocument()
    expect(
      screen.getByText('Members can run workflows concurrently')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Shared credit pool for all members')
    ).toBeInTheDocument()
    expect(screen.getByText('Role-based permissions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reactivate plan' }))

    expect(mockShowSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'settings_billing_panel'
    })
    expect(mockResubscribe).not.toHaveBeenCalled()
  })

  it('keeps ended Team credits inactive when self-serve capabilities are unavailable', () => {
    mockSubscriptionStatus.value = 'canceled'
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockCanSubscribeSelfServe.value = false
    renderComponent()

    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-inactive-plan',
      'true'
    )
  })

  it('does not show stale renewal copy for an explicitly ended active state', () => {
    mockSubscriptionStatus.value = 'ended'
    renderComponent()

    expect(screen.getByText('Your subscription has ended')).toBeInTheDocument()
    expect(screen.queryByText(/^Renews on/i)).not.toBeInTheDocument()
  })

  it.for([null, 'not-a-date', '2026-02-31T12:00:00Z'])(
    'uses safe cancellation copy when the active end date is %s',
    (endDate) => {
      mockSubscriptionStatus.value = 'canceled'
      mockEndDate.value = endDate
      renderComponent()

      expect(
        screen.getByText(
          "You won't be charged again. Your features remain active until the end of your billing period."
        )
      ).toBeInTheDocument()
      expect(screen.queryByText(/^Ends on/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
    }
  )

  it('keeps a cancelled Personal plan in a Team workspace reactivatable', () => {
    mockSubscriptionStatus.value = 'canceled'
    mockHasTeamPlan.value = false
    mockIsWorkspaceSubscribed.value = false
    renderComponent()

    expect(
      screen.getByText(`Ends on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reactivate plan' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe Now' })
    ).not.toBeInTheDocument()
  })

  it('hides Reactivate plan when the server denies reactivation to a client-side owner', () => {
    mockSubscriptionStatus.value = 'canceled'
    mockHasTeamPlan.value = false
    mockIsWorkspaceSubscribed.value = false
    mockCanManageSubscriptionLifecycle.value = true
    mockCanReactivatePlan.value = false
    renderComponent()

    expect(
      screen.getByText(`Ends on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reactivate plan' })
    ).not.toBeInTheDocument()
  })

  it('keeps Billing & invoices available to unsubscribed team owners', async () => {
    const user = userEvent.setup()
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    renderComponent()

    expect(
      screen.getByText('This workspace is not on a subscription')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe Now' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-zero-state',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()
  })

  it('lets a never-subscribed team workspace top up on Local instead of upselling', () => {
    mockDistributionState.isCloud = false
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    renderComponent()

    expect(
      screen.queryByText('This workspace is not on a subscription')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe Now' })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-zero-state',
      'false'
    )
  })

  it('shows a loading indicator instead of a false Free plan while billing loads', () => {
    mockHasSubscription.value = false
    mockIsLoading.value = true
    renderComponent()

    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
  })

  it('shows a retry affordance instead of a false Free plan when billing fails', async () => {
    const user = userEvent.setup()
    mockHasSubscription.value = false
    mockError.value = 'network down'
    renderComponent()

    expect(
      screen.getByText("We couldn't load your plan details.")
    ).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mockInitialize).toHaveBeenCalledOnce()
  })

  it('hides Subscribe Now when the server denies self-serve to a client-side owner', () => {
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    mockCanManageSubscription.value = true
    mockCanSubscribeSelfServe.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Subscribe Now' })
    ).not.toBeInTheDocument()
  })

  it('shows the zero-state contact-owner view to unsubscribed members', () => {
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockCanCancel.value = false
    mockCanReactivate.value = false
    mockCanChangeSeats.value = false
    mockCanSubscribeSelfServe.value = false
    renderComponent()

    expect(
      screen.getByText('Contact the workspace owner to subscribe')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe Now' })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-zero-state',
      'true'
    )
  })

  it('renders the Free plan header with Subscribe CTA for unsubscribed personal workspaces', async () => {
    const user = userEvent.setup()
    mockIsInPersonalWorkspace.value = true
    mockIsActiveSubscription.value = false
    mockHasSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockUiConfig.value = personalUiConfig
    mockCanLeaveWorkspace.value = false
    renderComponent()

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.getByText("What's included:")).toBeInTheDocument()
    expect(screen.getByText('10 min max runtime')).toBeInTheDocument()
    expect(
      screen.queryByText('RTX 6000 Pro (96GB VRAM)')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toHaveAttribute(
      'data-zero-state',
      'false'
    )

    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Subscribe' }))
    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it.for([
    { state: 'never-subscribed', hasSubscription: false, tier: 'PRO' },
    { state: 'Free', hasSubscription: true, tier: 'FREE' }
  ] as const)(
    'keeps billing access for $state personal workspaces',
    ({ hasSubscription, tier }) => {
      mockBillingType.value = 'legacy'
      mockBillingStatus.value = 'inactive'
      mockSubscriptionTier.value = tier
      mockIsInPersonalWorkspace.value = true
      mockIsActiveSubscription.value = false
      mockHasSubscription.value = hasSubscription
      mockIsWorkspaceSubscribed.value = false
      mockUiConfig.value = personalUiConfig
      mockCanLeaveWorkspace.value = false
      renderComponent()

      expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Billing & invoices' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Subscribe' })
      ).toBeInTheDocument()
    }
  )

  it('lets a Free personal workspace only rename itself (no Cancel or Delete)', async () => {
    const user = userEvent.setup()
    mockIsInPersonalWorkspace.value = true
    // A Free personal workspace routes to legacy billing, where lifecycle
    // authorization stays on the client.
    mockShouldUseWorkspaceBilling.value = false
    mockIsActiveSubscription.value = false
    mockHasSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockUiConfig.value = personalUiConfig
    mockCanLeaveWorkspace.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Cancel plan' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Edit workspace details' })
    )
    expect(mockShowEditWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('offers a subscribed personal workspace Edit and Cancel without Delete', () => {
    mockIsInPersonalWorkspace.value = true
    mockIsActiveSubscription.value = true
    mockHasSubscription.value = true
    mockIsWorkspaceSubscribed.value = false
    mockUiConfig.value = personalUiConfig
    mockCanLeaveWorkspace.value = false
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Edit workspace details' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cancel plan' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Leave Workspace' })
    ).not.toBeInTheDocument()
  })

  it('shows the personal plan identity when a team workspace holds a personal subscription', () => {
    const getTierPriceSpy = vi
      .spyOn(tierPricing, 'getTierPrice')
      .mockReturnValue(42)
    mockSubscriptionTier.value = 'STANDARD'
    mockPlanSlug.value = 'standard-annual'
    mockHasTeamPlan.value = false
    mockSubscriptionDuration.value = 'ANNUAL'
    mockCurrentTeamCreditStop.value = null
    renderComponent()

    expect(screen.getByText('Standard Yearly')).toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
    expect(getTierPriceSpy).toHaveBeenCalledWith('standard', true)
    expect(screen.getByText('$42')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.queryByText('USD / mo / member')).not.toBeInTheDocument()
    expect(screen.getByText('RTX 6000 Pro (96GB VRAM)')).toBeInTheDocument()
    expect(screen.queryByText('Invite members')).not.toBeInTheDocument()
  })

  it('shows the Team plan identity when a personal workspace holds a Team subscription', () => {
    mockIsInPersonalWorkspace.value = true
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Pro' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('$665')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.queryByText('USD / mo / member')).not.toBeInTheDocument()
    expect(screen.getByText('Invite members')).toBeInTheDocument()
    expect(
      screen.queryByText('RTX 6000 Pro (96GB VRAM)')
    ).not.toBeInTheDocument()
  })

  it('lists the four team perks under the Pro-inclusive heading', () => {
    renderComponent()

    expect(
      screen.getByText(/Your plan includes everything in/)
    ).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Invite members')).toBeInTheDocument()
    expect(
      screen.getByText('Members can run workflows concurrently')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Shared credit pool for all members')
    ).toBeInTheDocument()
    expect(screen.getByText('Role-based permissions')).toBeInTheDocument()
    expect(
      screen.queryByText('RTX 6000 Pro (96GB VRAM)')
    ).not.toBeInTheDocument()
  })

  it('offers members only Leave Workspace in the menu', () => {
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockCanCancel.value = false
    mockCanReactivate.value = false
    mockCanChangeSeats.value = false
    mockCanSubscribeSelfServe.value = false
    mockUiConfig.value = memberUiConfig
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel plan' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit workspace details' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('opens the leave-workspace dialog from a member menu', async () => {
    const user = userEvent.setup()
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockCanCancel.value = false
    mockCanReactivate.value = false
    mockCanChangeSeats.value = false
    mockCanSubscribeSelfServe.value = false
    mockUiConfig.value = memberUiConfig
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('offers an additional workspace owner Edit, Cancel, Leave, and locked Delete', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Edit workspace details' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cancel plan' }))
    expect(mockShowCancelSubscriptionFlow).toHaveBeenCalledWith(END_DATE_ISO)
  })

  it('enables Delete for any additional workspace owner once the plan is cancelled', () => {
    mockSubscriptionStatus.value = 'canceled'
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeEnabled()
  })
})

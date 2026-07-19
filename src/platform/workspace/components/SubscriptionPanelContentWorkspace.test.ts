import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json'
import type {
  CurrentTeamCreditStop,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionPanelContentWorkspace from './SubscriptionPanelContentWorkspace.vue'

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

const mockSubscriptionStatus = ref<'active' | 'canceled'>('active')
const mockSubscriptionDuration = ref<'MONTHLY' | 'ANNUAL'>('MONTHLY')
const mockHasSubscription = ref(true)
const mockIsActiveSubscription = ref(true)
const mockIsInPersonalWorkspace = ref(false)
const mockIsWorkspaceSubscribed = ref(true)
const mockCanManageSubscription = ref(true)
const mockCanManageSubscriptionLifecycle = ref(true)
const mockCanLeaveWorkspace = ref(true)
const mockTeamCreditStops = ref<TeamCreditStops | null>(teamCreditStops)
const mockCurrentTeamCreditStop = ref<CurrentTeamCreditStop | null>({
  id: 'team_700',
  credits_monthly: 147700,
  stop_usd: 700
})

const mockManageSubscription = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockResubscribe = vi.fn()
const mockShowLeaveWorkspaceDialog = vi.fn()
const mockShowCancelSubscriptionDialog = vi.fn()
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

const mockSubscription = computed<SubscriptionInfo | null>(() =>
  mockHasSubscription.value
    ? {
        isActive: true,
        tier: mockSubscriptionTier.value,
        duration: mockSubscriptionDuration.value,
        planSlug: mockPlanSlug.value,
        renewalDate: RENEWAL_DATE_ISO,
        endDate: END_DATE_ISO,
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
    isActiveSubscription: computed(() => mockIsActiveSubscription.value),
    isFreeTier: computed(() => false),
    isTeamPlan: mockIsTeamPlan,
    subscription: mockSubscription,
    teamCreditStops: mockTeamCreditStops,
    currentTeamCreditStop: mockCurrentTeamCreditStop,
    isLoading: mockIsLoading,
    error: mockError,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    manageSubscription: mockManageSubscription,
    resubscribe: mockResubscribe,
    initialize: mockInitialize
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

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({ isSettingUp: false })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCancelSubscriptionDialog: mockShowCancelSubscriptionDialog,
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
  props: ['zeroState'],
  template:
    '<div data-testid="credits-tile" :data-zero-state="String(zeroState)" />'
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

function renderComponent() {
  return render(SubscriptionPanelContentWorkspace, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      directives: { tooltip: {} },
      stubs: {
        CreditsTile: CreditsTileStub,
        Button: ButtonStub,
        SubscriptionFooterLinks: SubscriptionFooterLinksStub,
        StatusBadge: true,
        DropdownMenu: DropdownMenuStub
      }
    }
  })
}

describe('SubscriptionPanelContentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscriptionStatus.value = 'active'
    mockHasSubscription.value = true
    mockIsActiveSubscription.value = true
    mockIsInPersonalWorkspace.value = false
    mockIsWorkspaceSubscribed.value = true
    mockCanManageSubscription.value = true
    mockCanManageSubscriptionLifecycle.value = true
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

  it('wires Manage billing and Change plan actions for subscription managers', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Manage billing' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Change plan' }))
    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('keeps a Personal workspace Team-plan member view read-only', () => {
    mockIsInPersonalWorkspace.value = true
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockCanLeaveWorkspace.value = true
    mockUiConfig.value = memberUiConfig
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
    expect(screen.getByTestId('credits-tile')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Manage billing' })
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

  it('keeps an inactive paid Team plan visible in a Personal workspace', () => {
    mockIsInPersonalWorkspace.value = true
    mockIsActiveSubscription.value = false
    renderComponent()

    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()
  })

  it('reactivates a cancelled plan for an owner, keeping Manage billing', async () => {
    const user = userEvent.setup()
    mockSubscriptionStatus.value = 'canceled'
    mockCanLeaveWorkspace.value = false
    renderComponent()

    expect(
      screen.getByText(`Ends on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Manage billing' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change plan' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reactivate plan' }))
    expect(mockResubscribe).toHaveBeenCalledOnce()
  })

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

  it('shows the zero-state subscribe prompt to unsubscribed team owners', () => {
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

  it('shows the zero-state contact-owner view to unsubscribed members', () => {
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
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

    await user.click(screen.getByRole('button', { name: 'Subscribe' }))
    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('lets a Free personal workspace only rename itself (no Cancel or Delete)', async () => {
    const user = userEvent.setup()
    mockIsInPersonalWorkspace.value = true
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
    mockSubscriptionTier.value = 'STANDARD'
    mockPlanSlug.value = 'standard-annual'
    mockHasTeamPlan.value = false
    mockSubscriptionDuration.value = 'ANNUAL'
    mockCurrentTeamCreditStop.value = null
    renderComponent()

    expect(screen.getByText('Standard Yearly')).toBeInTheDocument()
    expect(screen.queryByText('Team')).not.toBeInTheDocument()
    expect(screen.getByText('$16')).toBeInTheDocument()
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
    expect(mockShowCancelSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('enables Delete for any additional workspace owner once the plan is cancelled', () => {
    mockSubscriptionStatus.value = 'canceled'
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeEnabled()
  })
})

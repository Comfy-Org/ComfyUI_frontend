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
// canManageSubscription = any owner (billing, change plan);
// canManageSubscriptionLifecycle = original owner only (cancel, resubscribe).
const mockCanManageSubscription = ref(true)
const mockCanManageSubscriptionLifecycle = ref(true)
const mockIsCurrentUserOriginalOwner = ref(true)
const mockMembers = ref([{ id: 'member-1' }, { id: 'member-2' }])
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

const mockSubscription = computed<SubscriptionInfo | null>(() =>
  mockHasSubscription.value
    ? {
        isActive: true,
        tier: 'PRO',
        duration: mockSubscriptionDuration.value,
        planSlug: 'team-monthly',
        renewalDate: RENEWAL_DATE_ISO,
        endDate: END_DATE_ISO,
        isCancelled: mockSubscriptionStatus.value === 'canceled',
        hasFunds: true
      }
    : null
)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: computed(() => mockIsActiveSubscription.value),
    isFreeTier: computed(() => false),
    subscription: mockSubscription,
    teamCreditStops: mockTeamCreditStops,
    currentTeamCreditStop: mockCurrentTeamCreditStop,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    manageSubscription: mockManageSubscription,
    resubscribe: mockResubscribe
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed,
    members: mockMembers,
    isCurrentUserOriginalOwner: mockIsCurrentUserOriginalOwner
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value,
      canManageSubscriptionLifecycle: mockCanManageSubscriptionLifecycle.value
    }))
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({ isSettingUp: false })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCancelSubscriptionDialog: vi.fn(),
    showLeaveWorkspaceDialog: mockShowLeaveWorkspaceDialog
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
  template: '<div data-testid="subscription-footer-links" />'
}

const MenuStub = {
  props: ['model'],
  template:
    '<ul data-testid="plan-menu"><li v-for="item in model" :key="item.label"><button type="button" :disabled="item.disabled" @click="item.command?.({})">{{ item.label }}</button></li></ul>'
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
        Menu: MenuStub
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
    mockIsCurrentUserOriginalOwner.value = true
    mockMembers.value = [{ id: 'member-1' }, { id: 'member-2' }]
    mockSubscriptionDuration.value = 'MONTHLY'
    mockTeamCreditStops.value = teamCreditStops
    mockCurrentTeamCreditStop.value = {
      id: 'team_700',
      credits_monthly: 147700,
      stop_usd: 700
    }
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
  })

  it('uses the yearly stop price for an annual subscription, still shown per month', () => {
    mockSubscriptionDuration.value = 'ANNUAL'
    mockCurrentTeamCreditStop.value = {
      id: 'team_2500',
      credits_monthly: 527500,
      stop_usd: 2500
    }
    renderComponent()

    // team_2500 yearly.price_cents 200000 -> $2000, labelled per month.
    expect(screen.getByText('$2000')).toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
  })

  it('falls back to the per-member tier price until stops resolve', () => {
    mockTeamCreditStops.value = null
    mockCurrentTeamCreditStop.value = null
    renderComponent()

    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('USD / mo / member')).toBeInTheDocument()
  })

  it('wires Manage billing and Change plan actions for subscription managers', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Manage billing' }))
    expect(mockManageSubscription).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Change plan' }))
    expect(mockShowSubscriptionDialog).toHaveBeenCalledOnce()
  })

  it('hides plan management actions from members without permission', () => {
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockIsCurrentUserOriginalOwner.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Manage billing' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Change plan' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Invite members')).toBeInTheDocument()
  })

  it('shows the Ends on subtitle and resubscribes from a cancelled subscription', async () => {
    const user = userEvent.setup()
    mockSubscriptionStatus.value = 'canceled'
    renderComponent()

    expect(
      screen.getByText(`Ends on ${formatPanelDate(END_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Manage billing' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resubscribe' }))
    expect(mockResubscribe).toHaveBeenCalledOnce()
  })

  it('hides Resubscribe from a non-creator owner on a cancelled subscription', () => {
    mockSubscriptionStatus.value = 'canceled'
    mockCanManageSubscriptionLifecycle.value = false
    mockIsCurrentUserOriginalOwner.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Resubscribe' })
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

  it('shows the zero-state contact-owner view to unsubscribed members', () => {
    mockIsActiveSubscription.value = false
    mockIsWorkspaceSubscribed.value = false
    mockHasSubscription.value = false
    mockCanManageSubscription.value = false
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

  it('offers Leave Workspace (not Cancel Subscription) to members', () => {
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockIsCurrentUserOriginalOwner.value = false
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel Subscription' })
    ).not.toBeInTheDocument()
  })

  it('lets a non-creator owner leave but not cancel the subscription', () => {
    mockCanManageSubscriptionLifecycle.value = false
    mockIsCurrentUserOriginalOwner.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Cancel Subscription' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
  })

  it('shows the workspace creator Cancel and a disabled Leave option', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Cancel Subscription' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeDisabled()
  })

  it('opens the leave-workspace dialog from the menu', async () => {
    const user = userEvent.setup()
    mockCanManageSubscription.value = false
    mockCanManageSubscriptionLifecycle.value = false
    mockIsCurrentUserOriginalOwner.value = false
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })
})

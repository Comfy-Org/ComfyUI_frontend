import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

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

// price_cents is the per-seat base price; seat_summary carries the
// seat-aware workspace total the panel must display.
const teamPlan: Plan = {
  slug: 'team-monthly',
  tier: 'PRO',
  duration: 'MONTHLY',
  price_cents: 8000,
  credits_cents: 8000,
  max_seats: 10,
  availability: { available: true },
  seat_summary: {
    seat_count: 4,
    total_cost_cents: 32000,
    total_credits_cents: 32000
  }
}

const mockSubscriptionStatus = ref<'active' | 'canceled'>('active')
const mockHasSubscription = ref(true)
const mockIsActiveSubscription = ref(true)
const mockIsInPersonalWorkspace = ref(false)
const mockIsWorkspaceSubscribed = ref(true)
const mockCanManageSubscription = ref(true)
const mockMembers = ref([
  {
    id: 'member-1',
    email: 'creator@example.com',
    joinDate: new Date('2026-01-01T00:00:00Z')
  },
  {
    id: 'member-2',
    email: 'me@example.com',
    joinDate: new Date('2026-02-01T00:00:00Z')
  }
])
const mockUserEmail = ref<string | null>('me@example.com')
const mockPlans = ref<Plan[]>([teamPlan])
const mockCurrentPlanSlug = ref<string | null>('team-monthly')

const mockManageSubscription = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockResubscribe = vi.fn()
const mockShowLeaveWorkspaceDialog = vi.fn()

const mockSubscription = computed<SubscriptionInfo | null>(() =>
  mockHasSubscription.value
    ? {
        isActive: true,
        tier: 'PRO',
        duration: 'MONTHLY',
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
    plans: mockPlans,
    currentPlanSlug: mockCurrentPlanSlug,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    manageSubscription: mockManageSubscription,
    resubscribe: mockResubscribe
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed,
    members: mockMembers
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userEmail: mockUserEmail })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: mockCanManageSubscription.value
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
    mockMembers.value = [
      {
        id: 'member-1',
        email: 'creator@example.com',
        joinDate: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'member-2',
        email: 'me@example.com',
        joinDate: new Date('2026-02-01T00:00:00Z')
      }
    ]
    mockUserEmail.value = 'me@example.com'
    mockPlans.value = [teamPlan]
    mockCurrentPlanSlug.value = 'team-monthly'
  })

  it('renders the team header with the seat-aware workspace price and renewal subtitle', () => {
    renderComponent()

    expect(screen.getByText('Team')).toBeInTheDocument()
    // Header reads seat_summary.total_cost_cents ($320 workspace total),
    // not the per-seat price_cents ($80).
    expect(screen.getByText('$320')).toBeInTheDocument()
    expect(screen.queryByText('$80')).not.toBeInTheDocument()
    expect(screen.getByText('USD / mo')).toBeInTheDocument()
    expect(screen.queryByText('USD / mo / member')).not.toBeInTheDocument()
    expect(
      screen.getByText(`Renews on ${formatPanelDate(RENEWAL_DATE_ISO)}`)
    ).toBeInTheDocument()
    expect(screen.getByTestId('subscription-footer-links')).toBeInTheDocument()
  })

  it('falls back to the per-member tier price until plans resolve', () => {
    mockPlans.value = []
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
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel Subscription' })
    ).not.toBeInTheDocument()
  })

  it('lets a non-creator owner both cancel the plan and leave', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Cancel Subscription' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeInTheDocument()
  })

  it('shows the workspace creator a disabled Leave option', () => {
    mockUserEmail.value = 'creator@example.com'
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
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })
})

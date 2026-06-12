import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SubscriptionInfo } from '@/composables/billing/types'

import SubscriptionPanelContentWorkspace from './SubscriptionPanelContentWorkspace.vue'

const isInPersonalWorkspaceRef = ref(true)
const isWorkspaceSubscribedRef = ref(true)
const isActiveSubscriptionRef = ref(true)
const subscriptionRef = ref<SubscriptionInfo | null>(null)

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: isInPersonalWorkspaceRef,
    isWorkspaceSubscribed: isWorkspaceSubscribedRef,
    members: ref([])
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: isActiveSubscriptionRef,
    isFreeTier: ref(false),
    subscription: subscriptionRef,
    showSubscriptionDialog: vi.fn(),
    manageSubscription: vi.fn(),
    fetchStatus: vi.fn(),
    fetchBalance: vi.fn(),
    getMaxSeats: () => 1,
    resubscribe: vi.fn()
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: ref({
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canRemoveMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canTopUp: true
    })
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({ isSettingUp: false })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ launchCancellationFlow: vi.fn() })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: vi.fn() })
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionActions',
  () => ({
    useSubscriptionActions: () => ({
      handleAddApiCredits: vi.fn(),
      handleRefresh: vi.fn()
    })
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionCredits',
  () => ({
    useSubscriptionCredits: () => ({
      totalCredits: '10',
      monthlyBonusCredits: '5',
      prepaidCredits: '5',
      isLoadingBalance: false
    })
  })
)

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: false,
  messages: {
    en: {
      g: { moreOptions: 'More options', error: 'Error' },
      billingOperation: { subscriptionProcessing: 'Setting up...' },
      subscription: {
        renewsDate: 'Renews {date}',
        expiresDate: 'Expires {date}',
        canceled: 'Canceled',
        canceledCard: {
          title: 'Subscription canceled',
          description: 'Active until {date}'
        },
        usdPerMonth: '/ month',
        usdPerMonthPerMember: '/ member / month',
        creditsRemainingThisMonth: 'Included (Refills {date})',
        creditsRemainingThisYear: 'Included (Refills {date})',
        creditsYouveAdded: "Credits you've added",
        totalCredits: 'Total Credits',
        managePayment: 'Manage payment',
        upgradePlan: 'Upgrade plan',
        resubscribe: 'Resubscribe',
        addCredits: 'Add credits',
        upgradeToAddCredits: 'Upgrade to add credits',
        subscribeNow: 'Subscribe now',
        workspaceNotSubscribed: 'Not subscribed',
        subscriptionRequiredMessage: 'Subscription required',
        contactOwnerToSubscribe: 'Contact owner',
        cancelSubscription: 'Cancel subscription',
        nextMonthInvoice: 'Next month',
        invoiceHistory: 'Invoice history',
        memberCount: '{n} member | {n} members',
        viewMoreDetailsPlans: 'View pricing',
        yourPlanIncludes: 'Your plan includes',
        tierNameYearly: '{name} Yearly',
        tiers: {
          standard: { name: 'Standard' },
          creator: { name: 'Creator' },
          pro: { name: 'Pro' },
          founder: { name: "Founder's Edition" }
        },
        membersLabel: '{count} members',
        resubscribeSuccess: 'Resubscribed'
      }
    }
  }
})

function activeSubscription(): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'CREATOR',
    duration: 'MONTHLY',
    planSlug: null,
    renewalDate: 'Jun 19, 2026',
    endDate: null,
    isCancelled: false,
    hasFunds: true
  }
}

function canceledSubscription(): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'CREATOR',
    duration: 'MONTHLY',
    planSlug: null,
    // Backend clears renewal_date once Stripe schedules a cancel_at; only
    // end_date remains populated. Mirror that here.
    renewalDate: null,
    endDate: 'Jun 19, 2026',
    isCancelled: true,
    hasFunds: true
  }
}

function renderPanel() {
  return render(SubscriptionPanelContentWorkspace, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: {
        StatusBadge: true,
        Skeleton: true,
        Menu: true,
        Button: { template: '<button><slot/></button>' }
      }
    }
  })
}

describe('SubscriptionPanelContentWorkspace', () => {
  beforeEach(() => {
    isInPersonalWorkspaceRef.value = true
    isWorkspaceSubscribedRef.value = true
    isActiveSubscriptionRef.value = true
    subscriptionRef.value = activeSubscription()
  })

  describe('cancel state', () => {
    it('renders "Expires {date}" for a canceled personal subscription', () => {
      isInPersonalWorkspaceRef.value = true
      subscriptionRef.value = canceledSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toContain('Expires Jun 19, 2026')
      expect(container.textContent).not.toContain('Renews')
    })

    it('renders "Expires {date}" for a canceled team subscription', () => {
      isInPersonalWorkspaceRef.value = false
      subscriptionRef.value = canceledSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toContain('Expires Jun 19, 2026')
      expect(container.textContent).not.toContain('Renews')
    })

    it('renders "Renews {date}" for an active personal subscription', () => {
      isInPersonalWorkspaceRef.value = true
      subscriptionRef.value = activeSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toContain('Renews Jun 19, 2026')
      expect(container.textContent).not.toContain('Expires')
    })
  })

  describe('action buttons when canceled', () => {
    it('shows Resubscribe for canceled team workspaces', () => {
      isInPersonalWorkspaceRef.value = false
      subscriptionRef.value = canceledSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toContain('Resubscribe')
      expect(container.textContent).not.toContain('Manage payment')
      expect(container.textContent).not.toContain('Upgrade plan')
    })

    it('shows Manage Payment + Upgrade for canceled personal subs (no Resubscribe)', () => {
      isInPersonalWorkspaceRef.value = true
      subscriptionRef.value = canceledSubscription()

      const { container } = renderPanel()

      expect(container.textContent).not.toContain('Resubscribe')
      expect(container.textContent).toContain('Manage payment')
      expect(container.textContent).toContain('Upgrade plan')
    })

    it('hides the more-options menu trigger when canceled to prevent re-canceling', () => {
      isInPersonalWorkspaceRef.value = true
      subscriptionRef.value = canceledSubscription()

      renderPanel()

      expect(screen.queryByLabelText('More options')).toBeNull()
    })

    it('shows the more-options menu trigger when active', () => {
      isInPersonalWorkspaceRef.value = true
      subscriptionRef.value = activeSubscription()

      renderPanel()

      expect(screen.getByLabelText('More options')).toBeInTheDocument()
    })
  })

  describe('refills date', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'UTC')
    })

    it('renders refills date from renewalDate when present', () => {
      subscriptionRef.value = activeSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toMatch(/Refills 06\/19\/26/)
    })

    it('falls back to endDate for refills when renewalDate is null (canceled)', () => {
      subscriptionRef.value = canceledSubscription()

      const { container } = renderPanel()

      expect(container.textContent).toMatch(/Refills 06\/19\/26/)
    })

    it('renders an empty refills date when neither renewalDate nor endDate is set', () => {
      subscriptionRef.value = {
        ...activeSubscription(),
        renewalDate: null,
        endDate: null
      }

      const { container } = renderPanel()

      expect(container.textContent).toMatch(/Refills \)/)
    })
  })
})

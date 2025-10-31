import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SubscriptionPanel from '@/platform/cloud/subscription/components/SubscriptionPanel.vue'

// Mock composables
const mockSubscriptionData = {
  isActiveSubscription: false,
  isCancelled: false,
  formattedRenewalDate: '2024-12-31',
  formattedEndDate: '2024-12-31',
  formattedMonthlyPrice: '$9.99',
  manageSubscription: vi.fn(),
  handleInvoiceHistory: vi.fn()
}

const mockCreditsData = {
  totalCredits: '10.00',
  monthlyBonusCredits: '5.00',
  prepaidCredits: '5.00',
  isLoadingBalance: false
}

const mockActionsData = {
  isLoadingSupport: false,
  refreshTooltip: 'Refreshes on 2024-12-31',
  handleAddApiCredits: vi.fn(),
  handleMessageSupport: vi.fn(),
  handleRefresh: vi.fn(),
  handleLearnMoreClick: vi.fn()
}

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => mockSubscriptionData
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionCredits',
  () => ({
    useSubscriptionCredits: () => mockCreditsData
  })
)

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionActions',
  () => ({
    useSubscriptionActions: () => mockActionsData
  })
)

// Create i18n instance for testing
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        title: 'Subscription',
        perMonth: '/ month',
        subscribeNow: 'Subscribe Now',
        manageSubscription: 'Manage Subscription',
        partnerNodesBalance: 'Partner Nodes Balance',
        partnerNodesDescription: 'Credits for partner nodes',
        totalCredits: 'Total Credits',
        monthlyBonusDescription: 'Monthly bonus',
        prepaidDescription: 'Prepaid credits',
        monthlyCreditsRollover: 'Monthly credits rollover info',
        prepaidCreditsInfo: 'Prepaid credits info',
        viewUsageHistory: 'View Usage History',
        addCredits: 'Add Credits',
        yourPlanIncludes: 'Your plan includes',
        learnMore: 'Learn More',
        messageSupport: 'Message Support',
        invoiceHistory: 'Invoice History',
        renewsDate: 'Renews {date}',
        expiresDate: 'Expires {date}'
      }
    }
  }
})

function createWrapper(overrides = {}) {
  return mount(SubscriptionPanel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: {
        CloudBadge: true,
        SubscribeButton: true,
        SubscriptionBenefits: true,
        Button: {
          template:
            '<button @click="$emit(\'click\')" :disabled="loading" :data-testid="label" :data-icon="icon">{{ label }}</button>',
          props: [
            'loading',
            'label',
            'icon',
            'text',
            'severity',
            'size',
            'iconPos',
            'pt'
          ],
          emits: ['click']
        },
        Skeleton: {
          template: '<div class="skeleton"></div>'
        }
      }
    },
    ...overrides
  })
}

describe('SubscriptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('subscription state functionality', () => {
    it('shows correct UI for active subscription', () => {
      mockSubscriptionData.isActiveSubscription = true
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Manage Subscription')
      expect(wrapper.text()).toContain('Add Credits')
    })

    it('shows correct UI for inactive subscription', () => {
      mockSubscriptionData.isActiveSubscription = false
      const wrapper = createWrapper()
      expect(wrapper.findComponent({ name: 'SubscribeButton' }).exists()).toBe(
        true
      )
      expect(wrapper.text()).not.toContain('Manage Subscription')
      expect(wrapper.text()).not.toContain('Add Credits')
    })

    it('shows renewal date for active non-cancelled subscription', () => {
      mockSubscriptionData.isActiveSubscription = true
      mockSubscriptionData.isCancelled = false
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Renews 2024-12-31')
    })

    it('shows expiry date for cancelled subscription', () => {
      mockSubscriptionData.isActiveSubscription = true
      mockSubscriptionData.isCancelled = true
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Expires 2024-12-31')
    })
  })

  describe('credit display functionality', () => {
    it('displays dynamic credit values correctly', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('$10.00') // totalCredits
      expect(wrapper.text()).toContain('$5.00') // both monthlyBonus and prepaid
    })

    it('shows loading skeleton when fetching balance', () => {
      mockCreditsData.isLoadingBalance = true
      const wrapper = createWrapper()
      expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0)
    })

    it('hides skeleton when balance loaded', () => {
      mockCreditsData.isLoadingBalance = false
      const wrapper = createWrapper()
      expect(wrapper.findAll('.skeleton').length).toBe(0)
    })
  })

  describe('action buttons', () => {
    it('should call handleLearnMoreClick when learn more is clicked', async () => {
      const wrapper = createWrapper()
      const learnMoreButton = wrapper.find('[data-testid="Learn More"]')
      await learnMoreButton.trigger('click')
      expect(mockActionsData.handleLearnMoreClick).toHaveBeenCalledOnce()
    })

    it('should call handleMessageSupport when message support is clicked', async () => {
      const wrapper = createWrapper()
      const supportButton = wrapper.find('[data-testid="Message Support"]')
      await supportButton.trigger('click')
      expect(mockActionsData.handleMessageSupport).toHaveBeenCalledOnce()
    })

    it('should call handleRefresh when refresh button is clicked', async () => {
      const wrapper = createWrapper()
      // Find the refresh button by icon
      const refreshButton = wrapper.find('[data-icon="pi pi-sync"]')
      await refreshButton.trigger('click')
      expect(mockActionsData.handleRefresh).toHaveBeenCalledOnce()
    })
  })

  describe('loading states', () => {
    it('should show loading state on support button when loading', () => {
      mockActionsData.isLoadingSupport = true
      const wrapper = createWrapper()
      const supportButton = wrapper.find('[data-testid="Message Support"]')
      expect(supportButton.attributes('disabled')).toBeDefined()
    })

    it('should show loading state on refresh button when loading balance', () => {
      mockCreditsData.isLoadingBalance = true
      const wrapper = createWrapper()
      const refreshButton = wrapper.find('[data-icon="pi pi-sync"]')
      expect(refreshButton.attributes('disabled')).toBeDefined()
    })
  })
})

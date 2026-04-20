import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionPanel from '@/platform/cloud/subscription/components/SubscriptionPanel.vue'

// Mock state refs that can be modified between tests
const mockCanAccessSubscriptionFeatures = ref(false)
const mockIsCancelled = ref(false)
const mockSubscriptionTier = ref<
  'STANDARD' | 'CREATOR' | 'PRO' | 'FOUNDERS_EDITION' | null
>('CREATOR')
const mockIsYearlySubscription = ref(false)

const TIER_TO_NAME: Record<string, string> = {
  STANDARD: 'Standard',
  CREATOR: 'Creator',
  PRO: 'Pro',
  FOUNDERS_EDITION: "Founder's Edition"
}

// Mock composables - using computed to match composable return types
const mockSubscriptionData = {
  canAccessSubscriptionFeatures: computed(
    () => mockCanAccessSubscriptionFeatures.value
  ),
  isCancelled: computed(() => mockIsCancelled.value),
  formattedRenewalDate: computed(() => '2024-12-31'),
  formattedEndDate: computed(() => '2024-12-31'),
  subscriptionTier: computed(() => mockSubscriptionTier.value),
  subscriptionTierName: computed(() => {
    if (!mockSubscriptionTier.value) return ''
    const baseName = TIER_TO_NAME[mockSubscriptionTier.value]
    return mockIsYearlySubscription.value ? `${baseName} Yearly` : baseName
  }),
  subscriptionStatus: computed(() => ({
    renewal_date: '2024-12-31T00:00:00Z'
  })),
  isYearlySubscription: computed(() => mockIsYearlySubscription.value),
  handleInvoiceHistory: vi.fn()
}

const mockCreditsData = {
  totalCredits: '10.00 Credits',
  monthlyBonusCredits: '5.00 Credits',
  prepaidCredits: '5.00 Credits',
  isLoadingBalance: false
}

const mockActionsData = {
  isLoadingSupport: false,
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

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      show: vi.fn()
    })
  })
)

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({
    authActions: vi.fn(() => ({
      accessBillingPortal: vi.fn()
    }))
  }))
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: computed(
      () => mockCanAccessSubscriptionFeatures.value
    ),
    manageSubscription: vi.fn()
  })
}))

// Create i18n instance for testing
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: true,
  messages: {
    en: {
      subscription: {
        title: 'Subscription',
        titleUnsubscribed: 'Subscribe',
        perMonth: '/ month',
        subscribeNow: 'Subscribe Now',
        manageSubscription: 'Manage Subscription',
        partnerNodesBalance: 'Partner Nodes Balance',
        partnerNodesDescription: 'Credits for partner nodes',
        totalCredits: 'Total Credits',
        creditsRemainingThisMonth: 'Included (Refills {date})',
        creditsRemainingThisYear: 'Included (Refills {date})',
        creditsYouveAdded: "Credits you've added",
        monthlyBonusDescription: 'Monthly bonus',
        prepaidDescription: 'Prepaid credits',
        monthlyCreditsRollover: 'Monthly credits rollover info',
        prepaidCreditsInfo: 'Prepaid credits info',
        viewUsageHistory: 'View Usage History',
        addCredits: 'Add Credits',
        yourPlanIncludes: 'Your plan includes',
        viewMoreDetailsPlans: 'View more details about plans & pricing',
        learnMore: 'Learn More',
        messageSupport: 'Message Support',
        refreshCredits: 'Refresh credits',
        invoiceHistory: 'Invoice History',
        partnerNodesCredits: 'Partner nodes pricing',
        renewsDate: 'Renews {date}',
        expiresDate: 'Expires {date}',
        tiers: {
          founder: {
            name: "Founder's Edition",
            price: '20.00',
            benefits: {
              monthlyCredits: '5,460',
              monthlyCreditsLabel: 'monthly credits',
              maxDuration: '30 min',
              maxDurationLabel: 'max duration of each workflow run',
              gpuLabel: 'RTX 6000 Pro (96GB VRAM)',
              addCreditsLabel: 'Add more credits whenever',
              customLoRAsLabel: 'Import your own LoRAs'
            }
          },
          standard: {
            name: 'Standard',
            price: '20.00',
            benefits: {
              monthlyCredits: '4,200',
              monthlyCreditsLabel: 'monthly credits',
              maxDuration: '30 min',
              maxDurationLabel: 'max duration of each workflow run',
              gpuLabel: 'RTX 6000 Pro (96GB VRAM)',
              addCreditsLabel: 'Add more credits whenever',
              customLoRAsLabel: 'Import your own LoRAs'
            }
          },
          creator: {
            name: 'Creator',
            price: '35.00',
            benefits: {
              monthlyCredits: '7,400',
              monthlyCreditsLabel: 'monthly credits',
              maxDuration: '30 min',
              maxDurationLabel: 'max duration of each workflow run',
              gpuLabel: 'RTX 6000 Pro (96GB VRAM)',
              addCreditsLabel: 'Add more credits whenever',
              customLoRAsLabel: 'Import your own LoRAs'
            }
          },
          pro: {
            name: 'Pro',
            price: '100.00',
            benefits: {
              monthlyCredits: '21,100',
              monthlyCreditsLabel: 'monthly credits',
              maxDuration: '1 hr',
              maxDurationLabel: 'max duration of each workflow run',
              gpuLabel: 'RTX 6000 Pro (96GB VRAM)',
              addCreditsLabel: 'Add more credits whenever',
              customLoRAsLabel: 'Import your own LoRAs'
            }
          }
        }
      }
    }
  }
})

function createComponent(overrides = {}) {
  return render(SubscriptionPanel, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],

      stubs: {
        CloudBadge: true,
        SubscribeButton: true,
        SubscriptionBenefits: true,
        Button: {
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\')" :disabled="loading" :data-testid="label" :data-icon="icon"><slot/></button>',
          props: ['variant', 'size', 'loading', 'label', 'icon'],
          emits: ['click']
        },
        Skeleton: {
          template: '<div role="status" aria-label="Loading"></div>'
        }
      }
    },
    ...overrides
  })
}

function findButtonByText(text: string) {
  const button = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(text))
  if (!button) throw new Error(`Button with text "${text}" not found`)
  return button
}

describe('SubscriptionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock state
    mockCanAccessSubscriptionFeatures.value = false
    mockIsCancelled.value = false
    mockSubscriptionTier.value = 'CREATOR'
    mockIsYearlySubscription.value = false
    mockCreditsData.isLoadingBalance = false
    mockActionsData.isLoadingSupport = false
  })

  describe('subscription state functionality', () => {
    it('shows correct UI for active subscription', () => {
      mockCanAccessSubscriptionFeatures.value = true
      const { container } = createComponent()
      expect(container.textContent).toContain('Manage Subscription')
      expect(container.textContent).toContain('Add Credits')
    })

    it('shows correct UI for inactive subscription', () => {
      mockCanAccessSubscriptionFeatures.value = false
      const { container } = createComponent()
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('subscribe-button-stub')).not.toBeNull()
      expect(container.textContent).not.toContain('Manage Subscription')
      expect(container.textContent).not.toContain('Add Credits')
    })

    it('shows renewal date for active non-cancelled subscription', () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsCancelled.value = false
      const { container } = createComponent()
      expect(container.textContent).toContain('Renews 2024-12-31')
    })

    it('shows expiry date for cancelled subscription', () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsCancelled.value = true
      const { container } = createComponent()
      expect(container.textContent).toContain('Expires 2024-12-31')
    })

    it('displays FOUNDERS_EDITION tier correctly', () => {
      mockSubscriptionTier.value = 'FOUNDERS_EDITION'
      const { container } = createComponent()
      expect(container.textContent).toContain("Founder's Edition")
      expect(container.textContent).toContain('5,460')
    })

    it('displays CREATOR tier correctly', () => {
      mockSubscriptionTier.value = 'CREATOR'
      const { container } = createComponent()
      expect(container.textContent).toContain('Creator')
      expect(container.textContent).toContain('7,400')
    })
  })

  describe('credit display functionality', () => {
    it('displays dynamic credit values correctly', () => {
      const { container } = createComponent()
      expect(container.textContent).toContain('10.00 Credits')
      expect(container.textContent).toContain('5.00 Credits')
    })

    it('shows loading skeleton when fetching balance', () => {
      mockCreditsData.isLoadingBalance = true
      createComponent()
      expect(
        screen.getAllByRole('status', { name: 'Loading' }).length
      ).toBeGreaterThan(0)
    })

    it('hides skeleton when balance loaded', () => {
      mockCreditsData.isLoadingBalance = false
      createComponent()
      expect(screen.queryAllByRole('status', { name: 'Loading' })).toHaveLength(
        0
      )
    })

    it('renders refill date with literal slashes', () => {
      vi.useFakeTimers()
      vi.stubEnv('TZ', 'UTC')
      try {
        mockCanAccessSubscriptionFeatures.value = true
        const { container } = createComponent()
        expect(container.textContent).toMatch(
          /Included \(Refills \d{2}\/\d{2}\/\d{2}\)/
        )
        expect(container.textContent).not.toContain('&#x2F;')
      } finally {
        vi.useRealTimers()
        vi.unstubAllEnvs()
      }
    })
  })

  describe('action buttons', () => {
    it('should call handleLearnMoreClick when learn more is clicked', async () => {
      createComponent()
      const learnMoreButton = findButtonByText('Learn More')
      await userEvent.click(learnMoreButton)
      expect(mockActionsData.handleLearnMoreClick).toHaveBeenCalledOnce()
    })

    it('should call handleMessageSupport when message support is clicked', async () => {
      createComponent()
      const supportButton = findButtonByText('Message Support')
      await userEvent.click(supportButton)
      expect(mockActionsData.handleMessageSupport).toHaveBeenCalledOnce()
    })

    it('should call handleRefresh when refresh button is clicked', async () => {
      createComponent()
      const refreshButton = screen.getByRole('button', {
        name: 'Refresh credits'
      })
      await userEvent.click(refreshButton)
      expect(mockActionsData.handleRefresh).toHaveBeenCalledOnce()
    })
  })

  describe('loading states', () => {
    it('should show loading state on support button when loading', () => {
      mockActionsData.isLoadingSupport = true
      createComponent()
      const supportButton = findButtonByText('Message Support')
      expect(supportButton).toBeDisabled()
    })

    it('should show loading state on refresh button when loading balance', () => {
      mockCreditsData.isLoadingBalance = true
      createComponent()
      const refreshButton = screen.getByRole('button', {
        name: 'Refresh credits'
      })
      expect(refreshButton).toBeDisabled()
    })
  })
})

import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import PricingTable from '@/platform/cloud/subscription/components/PricingTable.vue'
import Button from '@/components/ui/button/Button.vue'
import type { SubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

const mockIsActiveSubscription = ref(false)
const mockSubscriptionTier = ref<SubscriptionTier | null>(null)
const mockSubscriptionDuration = ref<'MONTHLY' | 'ANNUAL'>('MONTHLY')
const mockAccessBillingPortal = vi.fn()
const mockReportError = vi.fn()
const mockTrackBeginCheckout = vi.fn()
const mockUserId = ref<string | undefined>('user-123')
const mockGetAuthHeader = vi.fn(() =>
  Promise.resolve({ Authorization: 'Bearer test-token' })
)
const mockGetCheckoutAttribution = vi.hoisted(() => vi.fn(() => ({})))
const mockLocalStorage = vi.hoisted(() => {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    __reset: () => {
      store.clear()
    }
  }
})

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

const mockIsEduPricingActive = ref(false)

vi.mock('@/platform/cloud/subscription/composables/useEduPricing', () => ({
  useEduPricing: () => ({
    isEduPricingActive: computed(() => mockIsEduPricingActive.value)
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: computed(() => mockIsActiveSubscription.value),
    isFreeTier: computed(() => mockSubscriptionTier.value === 'FREE'),
    tier: computed(() => mockSubscriptionTier.value),
    subscription: computed(() =>
      mockSubscriptionTier.value
        ? {
            isActive: mockIsActiveSubscription.value,
            tier: mockSubscriptionTier.value,
            duration: mockSubscriptionDuration.value,
            planSlug: null,
            renewalDate: null,
            endDate: null,
            isCancelled: false,
            hasFunds: true
          }
        : null
    )
  })
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    accessBillingPortal: mockAccessBillingPortal,
    reportError: mockReportError
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: vi.fn(
      (fn, errorHandler) =>
        async (...args: unknown[]) => {
          try {
            return await fn(...args)
          } catch (error) {
            if (errorHandler) {
              errorHandler(error)
            }
            throw error
          }
        }
    )
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () =>
    reactive({
      getAuthHeader: mockGetAuthHeader,
      userId: computed(() => mockUserId.value)
    }),
  AuthStoreError: class extends Error {}
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBeginCheckout: mockTrackBeginCheckout
  })
}))

vi.mock('@/platform/telemetry/utils/checkoutAttribution', () => ({
  getCheckoutAttribution: mockGetCheckoutAttribution
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

global.fetch = vi.fn()

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        yearly: 'Yearly',
        monthly: 'Monthly',
        mostPopular: 'Most Popular',
        usdPerMonth: '/ month',
        billedYearly: 'Billed yearly ({total})',
        billedMonthly: 'Billed monthly',
        currentPlan: 'Current Plan',
        subscribeTo: 'Subscribe to {plan}',
        changeTo: 'Change to {plan}',
        tierNameYearly: '{name} Yearly',
        yearlyCreditsLabel: 'Yearly credits',
        monthlyCreditsLabel: 'Monthly credits',
        maxDurationLabel: 'Max duration',
        gpuLabel: 'GPU',
        addCreditsLabel: 'Add more credits',
        customLoRAsLabel: 'Custom LoRAs',
        videoEstimateLabel: 'Video estimate',
        videoEstimateHelp: 'How is this calculated?',
        videoEstimateExplanation: 'Based on average usage.',
        videoEstimateTryTemplate: 'Try template',
        soloUseOnly: 'Solo use only',
        needTeamWorkspace: 'Need team workspace?',
        maxDuration: {
          standard: '30 min',
          creator: '30 min',
          pro: '1 hr'
        },
        tiers: {
          standard: { name: 'Standard' },
          creator: { name: 'Creator' },
          pro: { name: 'Pro' }
        },
        benefits: {
          monthlyCredits: '{credits} monthly credits',
          maxDuration: '{duration} max duration',
          gpu: 'RTX 6000 Pro GPU',
          addCredits: 'Add more credits anytime',
          customLoRAs: 'Import custom LoRAs'
        }
      }
    }
  }
})

function renderComponent() {
  return render(PricingTable, {
    props: {
      onChooseTeamWorkspace: onChooseTeamWorkspace
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      components: {
        Button
      },
      stubs: {
        SelectButton: {
          template: `
            <div>
              <button
                v-for="option in options"
                :key="option.value"
                type="button"
                @click="$emit('update:modelValue', option.value)"
              >
                <slot name="option" :option="option">
                  {{ option.label }}
                </slot>
              </button>
            </div>
          `,
          props: ['modelValue', 'options'],
          emits: ['update:modelValue']
        },
        Popover: { template: '<div><slot /></div>' }
      }
    }
  })
}

const onChooseTeamWorkspace = vi.fn()

describe('PricingTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsActiveSubscription.value = false
    mockSubscriptionTier.value = null
    mockSubscriptionDuration.value = 'MONTHLY'
    mockIsEduPricingActive.value = false
    mockUserId.value = 'user-123'
    mockAccessBillingPortal.mockReset()
    mockAccessBillingPortal.mockResolvedValue(true)
    mockTrackBeginCheckout.mockReset()
    mockLocalStorage.__reset()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: 'https://checkout.stripe.com/test' })
    } as Response)
  })

  describe('billing portal deep linking', () => {
    it('should call accessBillingPortal with yearly tier suffix when billing cycle is yearly (default)', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'STANDARD'

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Creator'))

      expect(creatorButton).toBeDefined()
      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(mockTrackBeginCheckout).toHaveBeenCalledWith({
        user_id: 'user-123',
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'change',
        checkout_attempt_id: expect.any(String),
        previous_tier: 'standard'
      })
      expect(mockAccessBillingPortal).toHaveBeenCalledWith('creator-yearly')
    })

    it('should call accessBillingPortal with different tiers correctly', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'STANDARD'

      renderComponent()
      await flushPromises()

      const proButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Pro'))

      await userEvent.click(proButton!)
      await flushPromises()

      expect(mockAccessBillingPortal).toHaveBeenCalledWith('pro-yearly')
    })

    it('records the plan snapshot that was actually opened', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'STANDARD'

      const portalOpen = createDeferredPromise<boolean>()
      mockAccessBillingPortal.mockReturnValueOnce(portalOpen.promise)

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      const monthlyToggle = screen.getByRole('button', { name: 'Monthly' })
      await userEvent.click(monthlyToggle)
      await flushPromises()

      portalOpen.resolve(true)
      await flushPromises()

      expect(mockAccessBillingPortal).toHaveBeenCalledWith('creator-yearly')
      expect(
        JSON.parse(
          window.localStorage.getItem(
            PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
          ) ?? '{}'
        )
      ).toMatchObject({
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'change',
        previous_tier: 'standard',
        previous_cycle: 'monthly'
      })
    })

    it('does not record a pending upgrade when the billing portal does not open', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'STANDARD'
      mockAccessBillingPortal.mockResolvedValueOnce(false)

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(
        window.localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
      expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
    })

    it('should use the latest userId value when it changes after mount', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'STANDARD'
      mockUserId.value = 'user-early'

      renderComponent()
      await flushPromises()

      mockUserId.value = 'user-late'

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(mockTrackBeginCheckout).toHaveBeenCalledTimes(1)
      expect(mockTrackBeginCheckout).toHaveBeenCalledWith({
        user_id: 'user-late',
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'change',
        checkout_attempt_id: expect.any(String),
        previous_tier: 'standard'
      })
    })

    it('should not call accessBillingPortal when clicking current plan', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'CREATOR'
      mockSubscriptionDuration.value = 'ANNUAL'

      renderComponent()
      await flushPromises()

      const currentPlanButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Current Plan'))

      expect(currentPlanButton).toBeDefined()
      expect(currentPlanButton).toBeDisabled()
      await userEvent.click(currentPlanButton!)
      await flushPromises()

      expect(mockAccessBillingPortal).not.toHaveBeenCalled()
    })

    it('does not highlight a current plan when the facade duration differs from the selected cycle', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'CREATOR'
      mockSubscriptionDuration.value = 'MONTHLY'

      renderComponent()
      await flushPromises()

      const currentPlanButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Current Plan'))

      expect(currentPlanButton).toBeUndefined()
    })

    it('should initiate checkout instead of billing portal for new subscribers', async () => {
      mockIsActiveSubscription.value = false

      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      renderComponent()
      await flushPromises()

      const subscribeButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Subscribe'))

      await userEvent.click(subscribeButton!)
      await flushPromises()

      expect(mockAccessBillingPortal).not.toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-checkout/'),
        expect.any(Object)
      )
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://checkout.stripe.com/test',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should pass correct tier for each subscription level', async () => {
      mockIsActiveSubscription.value = true
      mockSubscriptionTier.value = 'PRO'

      renderComponent()
      await flushPromises()

      const standardButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Standard'))

      await userEvent.click(standardButton!)
      await flushPromises()

      expect(mockAccessBillingPortal).toHaveBeenCalledWith('standard-yearly')
    })
  })

  describe('team workspace link', () => {
    it('should emit chooseTeamWorkspace when clicking "Need team workspace?" link', async () => {
      renderComponent()
      await flushPromises()

      const teamLink = screen
        .getAllByRole('button')
        .find((b) => b.textContent?.includes('Need team workspace?'))

      expect(teamLink).toBeDefined()
      await userEvent.click(teamLink!)

      expect(onChooseTeamWorkspace).toHaveBeenCalledOnce()
    })
  })

  describe('EDU pricing', () => {
    it('shows discounted prices with the list price struck through when active', async () => {
      mockIsEduPricingActive.value = true
      const { container } = renderComponent()
      await flushPromises()

      // Yearly default: standard 15% off, $16/mo -> $13.6/mo, $192 -> $163.2.
      expect(screen.getByText('Billed yearly ($163.2)')).toBeInTheDocument()
      expect(container.textContent).toContain('$13.6')
      expect(container.textContent).toContain('$16')
    })

    it('keeps list prices when inactive', async () => {
      renderComponent()
      await flushPromises()

      expect(screen.getByText('Billed yearly ($192)')).toBeInTheDocument()
      expect(screen.queryByText('Billed yearly ($163.2)')).toBeNull()
    })

    it('discounts fractional monthly prices exactly', async () => {
      mockIsEduPricingActive.value = true
      const { container } = renderComponent()
      await flushPromises()

      await userEvent.click(screen.getByText('Monthly'))
      await flushPromises()

      // Creator monthly 15% off, $35 -> $29.75; display must match the coupon charge.
      expect(container.textContent).toContain('$29.75')
      expect(container.textContent).toContain('$35')
    })
  })
})

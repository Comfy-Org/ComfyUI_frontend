import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useTelemetry } from '@/platform/telemetry'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import PricingTable from '@/platform/cloud/subscription/components/PricingTable.vue'
import Button from '@/components/ui/button/Button.vue'
import type { IngestSubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
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

type BillingPortalResponse = Awaited<
  ReturnType<ReturnType<typeof useAuthStore>['accessBillingPortal']>
>

const billingPortal: BillingPortalResponse = {
  billing_portal_url: 'https://billing.stripe.com/p/session'
}

const mockCanAccessSubscriptionFeatures = ref(false)
const mockSubscriptionTier = ref<IngestSubscriptionTier | null>(null)
const mockSubscriptionDuration = ref<'MONTHLY' | 'ANNUAL'>('MONTHLY')

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

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('@/platform/telemetry/utils/checkoutAttribution'),
  () => ({
    getCheckoutAttribution: mockGetCheckoutAttribution
  })
)

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

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
        yearlyCreditsLabel: 'Total yearly credits',
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
      plugins: [i18n],
      components: {
        Button
      }
    }
  })
}

const onChooseTeamWorkspace = vi.fn()

beforeEach(() => {
  useErrorHandling().wrapWithErrorHandlingAsync =
    (action, errorHandler) =>
    async (...args) => {
      try {
        return await action(...args)
      } catch (error) {
        errorHandler?.(error)
      }
    }
  const billing = useBillingContext()
  billing.canAccessSubscriptionFeatures = computed(
    () => mockCanAccessSubscriptionFeatures.value
  )
  billing.isFreeTier = computed(() => mockSubscriptionTier.value === 'FREE')
  billing.tier = computed(() => mockSubscriptionTier.value)
  billing.subscription = computed(() =>
    mockSubscriptionTier.value
      ? {
          isActive: mockCanAccessSubscriptionFeatures.value,
          tier: mockSubscriptionTier.value,
          duration: mockSubscriptionDuration.value,
          planSlug: null,
          scheduledChange: null,
          renewalDate: null,
          endDate: null,
          isCancelled: false,
          hasFunds: true,
          agentHasFunds: true
        }
      : null
  )
  vi.mocked(useBillingContext).mockReturnValue(billing)
  Object.assign(useAuthStore(), { userId: 'user-123' })
  vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue({
    Authorization: 'Bearer test-token' as const
  })
  vi.mocked(useAuthStore().fetchWithCustomerRecovery).mockImplementation(
    (input, init) => fetch(input, init)
  )
  vi.mocked(useAuthStore().accessBillingPortal).mockResolvedValue(billingPortal)
  vi.spyOn(window, 'open').mockImplementation(() => window)
})

describe('PricingTable', () => {
  beforeEach(() => {
    mockCanAccessSubscriptionFeatures.value = false
    mockSubscriptionTier.value = null
    mockSubscriptionDuration.value = 'MONTHLY'
    Object.assign(useAuthStore(), { userId: 'user-123' })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-123'
    })
    mockLocalStorage.__reset()
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: 'https://checkout.stripe.com/test' })
    } as Response)
  })

  describe('billing portal deep linking', () => {
    it('should call accessBillingPortal with yearly tier suffix when billing cycle is yearly (default)', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Creator'))

      expect(creatorButton).toBeDefined()
      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith({
        user_id: 'user-123',
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'change',
        checkout_attempt_id: expect.any(String),
        previous_tier: 'standard'
      })
      expect(useAuthStore().accessBillingPortal).toHaveBeenCalledWith(
        'creator-yearly',
        undefined
      )
    })

    it('should call accessBillingPortal with different tiers correctly', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'

      renderComponent()
      await flushPromises()

      const proButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Pro'))

      await userEvent.click(proButton!)
      await flushPromises()

      expect(useAuthStore().accessBillingPortal).toHaveBeenCalledWith(
        'pro-yearly',
        undefined
      )
    })

    it('records the plan snapshot that was actually opened', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'

      const portalOpen = createDeferredPromise<BillingPortalResponse>()
      vi.mocked(useAuthStore().accessBillingPortal).mockReturnValueOnce(
        portalOpen.promise
      )

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      const monthlyToggle = screen.getByRole('button', { name: 'Monthly' })
      await userEvent.click(monthlyToggle)
      await flushPromises()

      portalOpen.resolve(billingPortal)
      await flushPromises()

      expect(useAuthStore().accessBillingPortal).toHaveBeenCalledWith(
        'creator-yearly',
        undefined
      )
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

    it('keeps the initiating account and workspace while the portal opens', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'
      Object.assign(useAuthStore(), { userId: 'user-early' })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-early'
      })
      const portalOpen = createDeferredPromise<BillingPortalResponse>()
      vi.mocked(useAuthStore().accessBillingPortal).mockReturnValueOnce(
        portalOpen.promise
      )

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((button) => button.textContent.includes('Creator'))
      await userEvent.click(creatorButton!)
      await flushPromises()

      Object.assign(useAuthStore(), { userId: 'user-late' })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-late'
      })
      portalOpen.resolve(billingPortal)
      await flushPromises()

      expect(
        JSON.parse(
          window.localStorage.getItem(
            PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
          ) ?? '{}'
        )
      ).toMatchObject({
        owner_id: 'user-early',
        workspace_id: 'workspace-early'
      })
    })

    it('does not record a pending upgrade when the billing portal does not open', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'
      vi.spyOn(window, 'open').mockImplementation(() => null)

      renderComponent()
      await flushPromises()

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(
        window.localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
      expect(useTelemetry()?.trackBeginCheckout).not.toHaveBeenCalled()
    })

    it('should use the latest userId value when it changes after mount', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'STANDARD'
      Object.assign(useAuthStore(), { userId: 'user-early' })

      renderComponent()
      await flushPromises()

      Object.assign(useAuthStore(), { userId: 'user-late' })

      const creatorButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Creator'))

      await userEvent.click(creatorButton!)
      await flushPromises()

      expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackBeginCheckout).toHaveBeenCalledWith({
        user_id: 'user-late',
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'change',
        checkout_attempt_id: expect.any(String),
        previous_tier: 'standard'
      })
    })

    it('should not call accessBillingPortal when clicking current plan', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'CREATOR'
      mockSubscriptionDuration.value = 'ANNUAL'

      renderComponent()
      await flushPromises()

      const currentPlanButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Current Plan'))

      expect(currentPlanButton).toBeDefined()
      expect(currentPlanButton).toBeDisabled()
      await userEvent.click(currentPlanButton!)
      await flushPromises()

      expect(useAuthStore().accessBillingPortal).not.toHaveBeenCalled()
    })

    it('does not highlight a current plan when the facade duration differs from the selected cycle', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'CREATOR'
      mockSubscriptionDuration.value = 'MONTHLY'

      renderComponent()
      await flushPromises()

      const currentPlanButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Current Plan'))

      expect(currentPlanButton).toBeUndefined()
    })

    it('should initiate checkout instead of billing portal for new subscribers', async () => {
      mockCanAccessSubscriptionFeatures.value = false

      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      renderComponent()
      await flushPromises()

      const subscribeButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Subscribe'))

      await userEvent.click(subscribeButton!)
      await flushPromises()

      expect(useAuthStore().accessBillingPortal).not.toHaveBeenCalled()
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

    it('tracks and rethrows a subscription checkout failure for new subscribers', async () => {
      mockCanAccessSubscriptionFeatures.value = false
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'declined for person@example.com' }),
        text: async () => ''
      } as Response)

      renderComponent()
      await flushPromises()

      const subscribeButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Subscribe'))

      await userEvent.click(subscribeButton!)
      await flushPromises()

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: 'standard',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        checkout_attempt_id: expect.any(String),
        failure_category: 'api_rejected',
        duration_ms: expect.any(Number)
      })
      expect(useErrorHandling().toastErrorHandler).toHaveBeenCalled()
    })

    it('categorizes a connectivity failure as network, not api_rejected', async () => {
      mockCanAccessSubscriptionFeatures.value = false
      vi.mocked(global.fetch).mockRejectedValue(
        new TypeError('Failed to fetch')
      )

      renderComponent()
      await flushPromises()

      const subscribeButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Subscribe'))

      await userEvent.click(subscribeButton!)
      await flushPromises()

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({ failure_category: 'network' })
      )
    })

    it('should pass correct tier for each subscription level', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockSubscriptionTier.value = 'PRO'

      renderComponent()
      await flushPromises()

      const standardButton = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Standard'))

      await userEvent.click(standardButton!)
      await flushPromises()

      expect(useAuthStore().accessBillingPortal).toHaveBeenCalledWith(
        'standard-yearly',
        undefined
      )
    })

    it.for([
      {
        name: 'the portal opens and the attempt waits for its success',
        currentTier: 'STANDARD',
        currentDuration: 'MONTHLY',
        target: 'Creator',
        portal: () => Promise.resolve(billingPortal),
        openedWindow: window,
        expectedEvents: [
          [
            {
              operation: 'subscription_checkout',
              stage: 'started',
              outcome: 'pending',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000006',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'change'
            }
          ]
        ],
        storedAttempt: expect.objectContaining({
          attempt_id: '00000000-0000-4000-8000-000000000006',
          start_reported: true
        })
      },
      {
        name: 'the browser blocks the portal tab',
        currentTier: 'STANDARD',
        currentDuration: 'MONTHLY',
        target: 'Creator',
        portal: () => Promise.resolve(billingPortal),
        openedWindow: null,
        expectedEvents: [
          [
            {
              operation: 'subscription_checkout',
              stage: 'started',
              outcome: 'pending',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000006',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'change'
            }
          ],
          [
            {
              operation: 'subscription_checkout',
              stage: 'failed',
              outcome: 'failure',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000006',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'change',
              failure_category: 'redirect',
              error_code: 'payment_popup_blocked',
              duration_ms: expect.any(Number)
            }
          ]
        ],
        storedAttempt: null
      },
      {
        name: 'the portal request is rejected',
        currentTier: 'STANDARD',
        currentDuration: 'MONTHLY',
        target: 'Creator',
        portal: () =>
          Promise.reject(new AuthStoreError('portal unavailable', 503)),
        openedWindow: window,
        expectedEvents: [
          [
            {
              operation: 'subscription_checkout',
              stage: 'started',
              outcome: 'pending',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000006',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'change'
            }
          ],
          [
            {
              operation: 'subscription_checkout',
              stage: 'failed',
              outcome: 'failure',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000006',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'change',
              failure_category: 'api_rejected',
              duration_ms: expect.any(Number)
            }
          ]
        ],
        storedAttempt: null
      },
      {
        name: 'a downgrade opens the plain portal and reports nothing',
        currentTier: 'PRO',
        currentDuration: 'ANNUAL',
        target: 'Standard',
        portal: () => Promise.resolve(billingPortal),
        openedWindow: window,
        expectedEvents: [],
        storedAttempt: null
      }
    ] as const)(
      'reports a portal plan change attempt once: $name',
      async ({
        currentTier,
        currentDuration,
        target,
        portal,
        openedWindow,
        expectedEvents,
        storedAttempt
      }) => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(
          '00000000-0000-4000-8000-000000000006'
        )
        mockCanAccessSubscriptionFeatures.value = true
        mockSubscriptionTier.value = currentTier
        mockSubscriptionDuration.value = currentDuration
        vi.mocked(useAuthStore().accessBillingPortal).mockImplementation(portal)
        vi.spyOn(window, 'open').mockImplementation(() => openedWindow)

        renderComponent()
        await flushPromises()
        const targetButton = screen
          .getAllByRole('button')
          .find((button) => button.textContent.includes(target))
        await userEvent.click(targetButton!)
        await flushPromises()

        const telemetry = useTelemetry()
        assert.exists(telemetry)
        expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual(
          expectedEvents
        )
        expect(
          JSON.parse(
            window.localStorage.getItem(
              PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
            ) ?? 'null'
          )
        ).toEqual(storedAttempt)
      }
    )
  })

  describe('credit allotment display', () => {
    it('states the whole-year allotment and a matching video estimate on the yearly cycle', async () => {
      renderComponent()
      await flushPromises()

      expect(screen.getAllByText('Total yearly credits')).toHaveLength(3)
      expect(screen.getByText('50,400')).toBeTruthy()
      expect(screen.getByText('~4,560')).toBeTruthy()
      expect(screen.getByText('253,200')).toBeTruthy()
      expect(screen.getByText('~22,980')).toBeTruthy()
    })

    it('keeps the monthly allotment when Monthly is selected again', async () => {
      renderComponent()
      await flushPromises()

      const monthly = screen.getByRole('button', { name: 'Monthly' })
      await userEvent.click(monthly)
      await userEvent.click(monthly)
      await nextTick()

      expect(monthly).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getAllByText('Monthly credits')).toHaveLength(3)
      expect(screen.getByText('4,200')).toBeTruthy()
      expect(screen.getByText('~380')).toBeTruthy()
    })
  })

  describe('team workspace link', () => {
    it('should emit chooseTeamWorkspace when clicking "Need team workspace?" link', async () => {
      renderComponent()
      await flushPromises()

      const teamLink = screen
        .getAllByRole('button')
        .find((b) => b.textContent.includes('Need team workspace?'))

      expect(teamLink).toBeDefined()
      await userEvent.click(teamLink!)

      expect(onChooseTeamWorkspace).toHaveBeenCalledOnce()
    })
  })
})
vi.mock(import('firebase/auth'))

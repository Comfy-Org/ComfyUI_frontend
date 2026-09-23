import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import type { BillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'

const {
  mockGetCheckoutAttribution,

  mockIsCloud,

  mockGetBillingStatus,

  mockLocalStorage
} = vi.hoisted(() => ({
  mockIsCloud: { value: true },

  mockGetBillingStatus: vi.fn(),

  mockGetCheckoutAttribution: vi.fn(() => ({
    im_ref: 'impact-click-001',
    utm_source: 'impact'
  })),
  mockLocalStorage: (() => {
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
  })()
}))

let scope: ReturnType<typeof effectScope> | undefined
type Distribution = 'desktop' | 'localhost' | 'cloud'

const setDistribution = (distribution: Distribution) => {
  ;(
    globalThis as typeof globalThis & { __DISTRIBUTION__: Distribution }
  ).__DISTRIBUTION__ = distribution
}

function useSubscriptionWithScope() {
  if (!scope) {
    throw new Error('Test scope not initialized')
  }

  const subscription = scope.run(() => useSubscription())
  if (!subscription) {
    throw new Error('Failed to initialize subscription composable')
  }

  return subscription
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock<unknown>(
  import('@/platform/telemetry/utils/checkoutAttribution'),
  () => ({
    getCheckoutAttribution: mockGetCheckoutAttribution
  })
)

vi.mock(import('@/platform/workspace/api/workspaceApi'))

/** Null is the legacy client; a rail is what the SDK store would hand back. */
const railState = vi.hoisted(() => ({
  rail: null as Pick<BillingReadRail, 'readStatus'> | null
}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingReadRail'),
  () => ({ useBillingReadRail: () => railState.rail })
)

vi.mock(import('@/services/dialogService'))

const mockReadStatus = vi.fn<BillingReadRail['readStatus']>()

const buildStatus = (
  overrides: Partial<BillingStatusResponse> = {}
): BillingStatusResponse => ({
  is_active: true,
  has_funds: true,
  max_seats: 1,
  occupied_seats: 1,
  scheduled_change: null,
  team_credit_stop: null,
  ...overrides
})

/**
 * The two clients the status read can go through, so the rows below pin one
 * behaviour on both rather than one path's behaviour twice.
 */
const statusReadPaths = [
  {
    reader: 'the workspace client',
    select: () => {
      railState.rail = null
    },
    resolve: (status: BillingStatusResponse) => {
      mockGetBillingStatus.mockResolvedValue(status)
    },
    fail: () => {
      mockGetBillingStatus.mockRejectedValue(
        new Error('Subscription not found')
      )
    },
    failure: 'Subscription not found',
    idleReader: () => mockReadStatus
  },
  {
    reader: 'the SDK reader',
    select: () => {
      railState.rail = { readStatus: mockReadStatus }
    },
    resolve: (status: BillingStatusResponse) => {
      mockReadStatus.mockResolvedValue({ status: 'ok', value: status })
    },
    fail: () => {
      mockReadStatus.mockResolvedValue({
        status: 'error',
        code: 'ACCESS_DENIED',
        httpStatus: 403
      })
    },
    failure: 'ACCESS_DENIED',
    idleReader: () => mockGetBillingStatus
  }
]

// Mock fetch
global.fetch = vi.fn()

beforeEach(() => {
  useErrorHandling().wrapWithErrorHandlingAsync =
    (action, errorHandler) =>
    async (...args) => {
      try {
        return await action(...args)
      } catch (error) {
        errorHandler?.(error)
        throw error
      }
    }
  vi.mocked(workspaceApi.getBillingStatus).mockImplementation(
    mockGetBillingStatus
  )
  Object.assign(useAuthStore(), { isInitialized: true, userId: 'user-123' })
  vi.mocked(useAuthStore().getFirebaseAuthHeader).mockResolvedValue({
    Authorization: 'Bearer test-token' as const
  })
  vi.mocked(useAuthStore().fetchWithCustomerRecovery).mockImplementation(
    (input, init) => fetch(input, init)
  )
})

describe('useSubscription', () => {
  afterEach(() => {
    scope?.stop()
    scope = undefined
    setDistribution('localhost')
    mockLocalStorage.__reset()
  })

  beforeEach(() => {
    scope?.stop()
    scope = effectScope()
    setDistribution('cloud')

    mockLocalStorage.__reset()
    railState.rail = null
    Object.assign(useAuthStore(), { userId: 'user-123' })
    mockIsCloud.value = true
    Object.assign(useAuthStore(), { isInitialized: true })
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-123'
    })
    mockGetBillingStatus.mockResolvedValue({
      is_active: false,
      has_funds: false,
      team_credit_stop: null
    })
    window.__CONFIG__ = {
      subscription_required: true
    }
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        is_active: false,
        subscription_id: '',
        renewal_date: ''
      })
    } as Response)
  })

  describe('computed properties', () => {
    it('should compute canAccessSubscriptionFeatures correctly when subscription is active', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { canAccessSubscriptionFeatures, fetchStatus } =
        useSubscriptionWithScope()

      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })

    it('should compute canAccessSubscriptionFeatures as false when subscription is inactive', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { canAccessSubscriptionFeatures, fetchStatus } =
        useSubscriptionWithScope()

      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(false)
    })

    it('should format renewal date correctly', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16T12:00:00Z'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { formattedRenewalDate, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      // The date format may vary based on timezone, so we just check it's a valid date string
      expect(formattedRenewalDate.value).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/)
      expect(formattedRenewalDate.value).toContain('2025')
      expect(formattedRenewalDate.value).toContain('Nov')
    })

    it('should return empty string when renewal date is not available', () => {
      const { formattedRenewalDate } = useSubscriptionWithScope()

      expect(formattedRenewalDate.value).toBe('')
    })

    it('should return subscription tier from status', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'CREATOR',
        renewal_date: '2025-11-16T12:00:00Z'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { subscriptionTier, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(subscriptionTier.value).toBe('CREATOR')
    })

    it('should return null when subscription tier is not available', () => {
      const { subscriptionTier } = useSubscriptionWithScope()

      expect(subscriptionTier.value).toBeNull()
    })

    it('derives cancellation state and end date from cancel_at', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        cancel_at: '2025-12-01T12:00:00Z'
      })

      const { isCancelled, formattedEndDate, fetchStatus } =
        useSubscriptionWithScope()
      await fetchStatus()

      expect(isCancelled.value).toBe(true)
      expect(formattedEndDate.value).toBe('Dec 1, 2025')
    })
  })

  describe('fetchStatus', () => {
    it.for(statusReadPaths)(
      'publishes a status read through $reader and updates the workspace billing rail',
      async (path) => {
        const status = buildStatus({
          renewal_date: '2025-11-16',
          billing_rail: 'stripe'
        })
        path.select()
        path.resolve(status)

        useCurrentUser().isLoggedIn = computed(() => true)
        const { subscriptionStatus, fetchStatus } = useSubscriptionWithScope()

        await fetchStatus()

        expect(subscriptionStatus.value).toEqual(status)
        expect(
          useTeamWorkspaceStore().setWorkspaceBillingRail
        ).toHaveBeenCalledWith('workspace-123', 'stripe')
        // One transport per read: the rail a read is on is the only client it
        // asks, or the panels read one thing and the rail settled another.
        expect(path.idleReader()).not.toHaveBeenCalled()
      }
    )

    it.for(statusReadPaths)(
      'reports a failed read through $reader in the same message',
      async (path) => {
        path.select()
        path.fail()

        const { fetchStatus } = useSubscriptionWithScope()

        await expect(fetchStatus()).rejects.toThrow(
          `Failed to fetch subscription status: ${path.failure}`
        )
      }
    )

    it('keeps the published status when a rail read is superseded', async () => {
      const published = buildStatus({ renewal_date: '2025-11-16' })
      mockGetBillingStatus.mockResolvedValue(published)
      const { subscriptionStatus, fetchStatus } = useSubscriptionWithScope()
      await fetchStatus()

      railState.rail = { readStatus: mockReadStatus }
      mockReadStatus.mockResolvedValue({
        status: 'error',
        code: 'SUPERSEDED'
      })
      await expect(fetchStatus()).resolves.toBeNull()

      expect(subscriptionStatus.value).toEqual(published)
    })

    it('does not apply the previous account response after an identity switch', async () => {
      let resolvePreviousAccount!: (value: {
        is_active: boolean
        has_funds: boolean
        billing_rail: 'stripe'
      }) => void
      mockGetBillingStatus
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolvePreviousAccount = resolve
          })
        )
        .mockResolvedValueOnce({
          is_active: false,
          has_funds: false,
          billing_rail: 'legacy_stripe'
        })

      const { subscriptionStatus, fetchStatus } = useSubscriptionWithScope()
      const previousAccountRequest = fetchStatus()

      Object.assign(useAuthStore(), { userId: 'user-456' })
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-456'
      })
      const currentAccountRequest = fetchStatus()
      await currentAccountRequest

      resolvePreviousAccount({
        is_active: true,
        has_funds: true,
        billing_rail: 'stripe'
      })
      await previousAccountRequest

      expect(mockGetBillingStatus).toHaveBeenCalledTimes(2)
      expect(subscriptionStatus.value).toEqual({
        is_active: false,
        has_funds: false,
        billing_rail: 'legacy_stripe'
      })
      expect(
        useTeamWorkspaceStore().setWorkspaceBillingRail
      ).toHaveBeenCalledOnce()
      expect(
        useTeamWorkspaceStore().setWorkspaceBillingRail
      ).toHaveBeenCalledWith('workspace-456', 'legacy_stripe')
    })

    it('coalesces concurrent callers into one fetch', async () => {
      let resolveStatus: (value: {
        is_active: boolean
        has_funds: boolean
      }) => void = () => {}
      mockGetBillingStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve
        })
      )
      const { fetchStatus } = useSubscriptionWithScope()

      const first = fetchStatus()
      const second = fetchStatus()
      resolveStatus({ is_active: true, has_funds: true })
      await Promise.all([first, second])

      expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
    })

    it('does not downgrade known-good status on a failed fetch', async () => {
      mockGetBillingStatus.mockResolvedValueOnce({
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1
      })
      const { fetchStatus, canAccessSubscriptionFeatures } =
        useSubscriptionWithScope()
      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(true)

      mockGetBillingStatus.mockRejectedValueOnce(new Error('Invalid token'))
      await fetchStatus().catch(() => {})

      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('should initiate subscription checkout successfully', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/test'

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: checkoutUrl })
      } as Response)

      // Mock window.open
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => window)

      const { subscribe } = useSubscriptionWithScope()

      await subscribe()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-checkout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token' as const,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            im_ref: 'impact-click-001',
            utm_source: 'impact'
          })
        })
      )

      expect(windowOpenSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
      expect(
        JSON.parse(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) ??
            '{}'
        )
      ).toMatchObject({
        tier: 'standard',
        cycle: 'monthly',
        checkout_type: 'new'
      })

      windowOpenSpy.mockRestore()
    })

    it('should throw error when checkout URL is not returned', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response)

      const { subscribe } = useSubscriptionWithScope()

      await expect(subscribe()).rejects.toThrow()
    })
  })

  describe('subscribeDirect', () => {
    it('performs the same checkout as subscribe on success', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/direct'
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: checkoutUrl })
      } as Response)
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => window)

      const { subscribeDirect } = useSubscriptionWithScope()

      await expect(subscribeDirect()).resolves.toBeUndefined()
      expect(windowOpenSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')

      windowOpenSpy.mockRestore()
    })

    it('rejects on failure without going through the error-swallowing wrapper', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response)

      const { subscribeDirect } = useSubscriptionWithScope()

      await expect(subscribeDirect()).rejects.toThrow()
      expect(useAuthActions().reportError).not.toHaveBeenCalled()
    })

    it('tags the pending attempt as a resubscribe when called with operation/source', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/direct'
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: checkoutUrl })
      } as Response)
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => window)

      const { subscribeDirect } = useSubscriptionWithScope()

      await subscribeDirect({
        operation: 'resubscribe',
        source: 'settings_billing_panel'
      })

      const stored = JSON.parse(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) ?? '{}'
      )
      expect(stored.operation).toBe('resubscribe')
      expect(stored.resubscribe_source).toBe('settings_billing_panel')

      windowOpenSpy.mockRestore()
    })
  })

  describe('pending checkout recovery', () => {
    it('emits subscription_success when a pending new subscription becomes active', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-123',
          started_at_ms: Date.now(),
          tier: 'creator',
          cycle: 'yearly',
          checkout_type: 'new'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'CREATOR',
        subscription_duration: 'ANNUAL',
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          useTelemetry()?.trackMonthlySubscriptionSucceeded
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'user-123',
            checkout_attempt_id: 'attempt-123',
            tier: 'creator',
            cycle: 'yearly',
            checkout_type: 'new',
            value: 336,
            currency: 'USD'
          })
        )
      })
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
    })

    it('emits subscription_success when a pending upgrade reaches the target tier', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-456',
          started_at_ms: Date.now(),
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'creator',
          previous_cycle: 'monthly'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          useTelemetry()?.trackMonthlySubscriptionSucceeded
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            checkout_attempt_id: 'attempt-456',
            tier: 'pro',
            cycle: 'monthly',
            checkout_type: 'change',
            previous_tier: 'creator',
            value: 100
          })
        )
      })
    })

    it('emits the canonical resubscribe terminal when a resubscribe-tagged attempt becomes active', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-789',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new',
          operation: 'resubscribe',
          resubscribe_source: 'pricing_dialog'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY',
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source: 'pricing_dialog'
        })
      })
    })

    it('does not emit a resubscribe terminal for a plain (non-resubscribe) pending attempt', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-999',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY',
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          useTelemetry()?.trackMonthlySubscriptionSucceeded
        ).toHaveBeenCalled()
      })
      expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalled()
    })

    it('rechecks pending checkout attempts when the document becomes visible', async () => {
      useCurrentUser().isLoggedIn = computed(() => true)
      const visibilityStateSpy = vi
        .spyOn(document, 'visibilityState', 'get')
        .mockReturnValue('visible')

      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })

      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockGetBillingStatus.mockClear()
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-visible',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      document.dispatchEvent(new Event('visibilitychange'))

      await vi.waitFor(() => {
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
      })
      visibilityStateSpy.mockRestore()
    })

    it('rechecks pending checkout attempts on status refresh', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })

      const { fetchStatus } = useSubscriptionWithScope()
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-refresh',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      await fetchStatus()

      await vi.waitFor(() => {
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
      })
    })

    it('does not clear pending attempts before auth initialization resolves', async () => {
      Object.assign(useAuthStore(), { isInitialized: false })
      useCurrentUser().isLoggedIn = computed(() => false)

      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-pre-auth',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).not.toBeNull()
      })
    })

    it('clears pending checkout attempts when initialized while logged out', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-logout',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      useCurrentUser().isLoggedIn = computed(() => false)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      })
    })
  })

  describe('requireActiveSubscription', () => {
    it('should not show dialog when subscription is active', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

      const { requireActiveSubscription } = useSubscriptionWithScope()

      await requireActiveSubscription()

      expect(
        useDialogService().showSubscriptionRequiredDialog
      ).not.toHaveBeenCalled()
    })

    it('should show dialog when subscription is inactive', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

      const { requireActiveSubscription } = useSubscriptionWithScope()

      await requireActiveSubscription()

      expect(
        useDialogService().showSubscriptionRequiredDialog
      ).toHaveBeenCalled()
    })
  })

  describe('non-cloud environments', () => {
    it('should not fetch subscription status when not on cloud', async () => {
      mockIsCloud.value = false
      useCurrentUser().isLoggedIn = computed(() => true)

      useSubscriptionWithScope()

      await vi.dynamicImportSettled()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should report canAccessSubscriptionFeatures as true when not on cloud', () => {
      mockIsCloud.value = false

      const { canAccessSubscriptionFeatures } = useSubscriptionWithScope()

      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })

    it('does not perform explicit subscription status reads outside Cloud', async () => {
      mockIsCloud.value = false
      const { fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()

      expect(mockGetBillingStatus).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('action handlers', () => {
    it('should open usage history URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleViewUsageHistory } = useSubscriptionWithScope()
      handleViewUsageHistory()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://stagingplatform.comfy.org/profile/usage',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should open learn more URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleLearnMore } = useSubscriptionWithScope()
      handleLearnMore()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://docs.comfy.org',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should call accessBillingPortal for invoice history', async () => {
      const { handleInvoiceHistory } = useSubscriptionWithScope()

      await handleInvoiceHistory()

      expect(useAuthActions().accessBillingPortal).toHaveBeenCalled()
    })

    it('should call accessBillingPortal for manage subscription', async () => {
      const { manageSubscription } = useSubscriptionWithScope()

      await manageSubscription()

      expect(useAuthActions().accessBillingPortal).toHaveBeenCalled()
    })

    it('does not start cancellation watching when the billing portal does not open', async () => {
      useCurrentUser().isLoggedIn = computed(() => true)
      vi.mocked(useAuthActions().accessBillingPortal).mockResolvedValueOnce(
        false
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

      const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

      await fetchStatus()
      mockGetBillingStatus.mockClear()

      await manageSubscription()
      await vi.advanceTimersByTimeAsync(5000)

      expect(mockGetBillingStatus).not.toHaveBeenCalled()
      expect(
        useTelemetry()?.trackMonthlySubscriptionCancelled
      ).not.toHaveBeenCalled()
    })

    it('tracks cancellation after manage subscription when status flips', async () => {
      useCurrentUser().isLoggedIn = computed(() => true)

      const activeStatus = {
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      }

      const cancelledStatus = {
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16',
        cancel_at: '2025-12-01'
      }

      mockGetBillingStatus
        .mockResolvedValueOnce(activeStatus)
        .mockResolvedValueOnce(cancelledStatus)

      const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

      await fetchStatus()
      await manageSubscription()

      await vi.advanceTimersByTimeAsync(5000)

      expect(
        useTelemetry()?.trackMonthlySubscriptionCancelled
      ).toHaveBeenCalledTimes(1)
    })

    it('handles rapid focus events during cancellation polling', async () => {
      useCurrentUser().isLoggedIn = computed(() => true)

      const activeStatus = {
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      }

      const cancelledStatus = {
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16',
        cancel_at: '2025-12-01'
      }

      mockGetBillingStatus
        .mockResolvedValueOnce(activeStatus)
        .mockResolvedValueOnce(cancelledStatus)

      const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

      await fetchStatus()
      await manageSubscription()

      window.dispatchEvent(new Event('focus'))
      await vi.waitFor(() => {
        expect(
          useTelemetry()?.trackMonthlySubscriptionCancelled
        ).toHaveBeenCalledTimes(1)
      })
    })
  })
})
vi.mock(import('firebase/auth'))

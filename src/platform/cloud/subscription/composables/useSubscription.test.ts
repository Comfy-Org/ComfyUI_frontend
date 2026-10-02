import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import { SessionTokenError } from '@comfyorg/account-core/sessionTokenMint'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { webSessionResourceHeader } from '@/platform/auth/session/webSessionFetch'
import { useTelemetry } from '@/platform/telemetry'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import type { BillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import {
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
  claimPendingCheckoutTerminal
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'

const {
  mockGetCheckoutAttribution,
  mockTelemetry,
  mockIsLoggedIn,
  mockCurrentUser,

  mockIsCloud,

  mockGetBillingStatus,

  mockLocalStorage,
  mockReportTelemetryError,
  mockReportError,
  mockAccessBillingPortal
} = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  const mockIsLoggedIn = ref(false)
  return {
    mockIsLoggedIn,
    mockCurrentUser: { isLoggedIn: mockIsLoggedIn },
    mockIsCloud: { value: true },

    mockGetBillingStatus: vi.fn(),

    mockReportTelemetryError: vi.fn(),
    mockReportError: vi.fn(),
    mockAccessBillingPortal: vi.fn(),
    mockGetCheckoutAttribution: vi.fn(() => ({
      im_ref: 'impact-click-001',
      utm_source: 'impact'
    })),
    mockTelemetry: {
      trackSubscription: vi.fn(),
      trackMonthlySubscriptionSucceeded: vi.fn(),
      trackMonthlySubscriptionCancelled: vi.fn(),
      trackBeginCheckout: vi.fn(),
      trackBillingEvent: vi.fn()
    },
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
  }
})

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

vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: vi.fn(() => mockCurrentUser)
}))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock<unknown>(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportTelemetryError
}))

vi.mock<unknown>(import('@/composables/auth/useAuthActions'), () => ({
  useAuthActions: vi.fn(() => ({
    reportError: mockReportError,
    accessBillingPortalDirect: mockAccessBillingPortal
  }))
}))

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

vi.mock(import('@/platform/auth/session/webSessionFetch'), { spy: true })

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
  vi.mocked(webSessionResourceHeader).mockReset()
  vi.mocked(webSessionResourceHeader).mockResolvedValue(undefined)
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
  mockAccessBillingPortal.mockResolvedValue(true)
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
    mockIsLoggedIn.value = false
    mockCurrentUser.isLoggedIn = mockIsLoggedIn
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

    it('labels a TEAM subscription with the team-plan name, not the Standard fallback', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'TEAM',
        renewal_date: '2025-11-16T12:00:00Z'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { subscriptionTierName, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(subscriptionTierName.value).toBe('Team')
    })

    it('labels an ENTERPRISE subscription with the Enterprise catalog name', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'ENTERPRISE',
        renewal_date: '2025-11-16T12:00:00Z'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { subscriptionTierName, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(subscriptionTierName.value).toBe('Enterprise')
    })

    it('labels a tier with no catalog entry as the current plan, not Standard', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'LEGACY_UNMAPPED',
        renewal_date: '2025-11-16T12:00:00Z'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      const { subscriptionTierName, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(subscriptionTierName.value).toBe('Current plan')
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

    it('retries recovery when a status read is superseded', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-superseded-recovery',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      railState.rail = { readStatus: mockReadStatus }
      mockReadStatus
        .mockResolvedValueOnce({ status: 'error', code: 'SUPERSEDED' })
        .mockResolvedValueOnce({
          status: 'ok',
          value: buildStatus({
            is_active: false,
            has_funds: false,
            renewal_date: ''
          })
        })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(3_000)

      expect(mockReadStatus).toHaveBeenCalledTimes(2)
    })

    it('does not publish an evicted status read after its replacement', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-evicted-read',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      let resolveEvicted!: (status: BillingStatusResponse) => void
      mockGetBillingStatus
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveEvicted = resolve
          })
        )
        .mockResolvedValueOnce(
          buildStatus({
            is_active: true,
            has_funds: true,
            renewal_date: 'active',
            subscription_tier: 'STANDARD',
            subscription_duration: 'MONTHLY'
          })
        )
      mockIsLoggedIn.value = true

      const { subscriptionStatus } = useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(10_000)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(subscriptionStatus.value?.is_active).toBe(true)

      resolveEvicted(
        buildStatus({
          is_active: false,
          has_funds: false,
          renewal_date: 'stale'
        })
      )
      await vi.advanceTimersByTimeAsync(0)

      expect(subscriptionStatus.value?.is_active).toBe(true)
      expect(subscriptionStatus.value?.renewal_date).toBe('active')
    })

    it('publishes a slow shared status read when no replacement started', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-evicted-without-replacement',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      let resolveEvicted!: (status: BillingStatusResponse) => void
      mockGetBillingStatus.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveEvicted = resolve
        })
      )
      mockIsLoggedIn.value = true

      const { subscriptionStatus } = useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(10_000)
      resolveEvicted(
        buildStatus({
          is_active: true,
          renewal_date: 'stale-without-replacement'
        })
      )
      await vi.advanceTimersByTimeAsync(0)

      expect(subscriptionStatus.value?.renewal_date).toBe(
        'stale-without-replacement'
      )
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

    it.for([
      {
        name: 'no web session sends the Firebase header',
        session: undefined,
        authorization: 'Bearer test-token',
        firebaseCalls: 1
      },
      {
        name: 'a web session sends its own header instead',
        session: { Authorization: 'Bearer session-jwt' },
        authorization: 'Bearer session-jwt',
        firebaseCalls: 0
      }
    ])(
      'authorizes the checkout: $name',
      async ({ session, authorization, firebaseCalls }) => {
        vi.mocked(webSessionResourceHeader).mockResolvedValue(session)
        vi.mocked(global.fetch).mockResolvedValue(
          new Response(
            JSON.stringify({ checkout_url: 'https://checkout.stripe.com/x' })
          )
        )
        const windowOpenSpy = vi
          .spyOn(window, 'open')
          .mockImplementation(() => window)

        await useSubscriptionWithScope().subscribeDirect()

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/customers/cloud-subscription-checkout'),
          expect.objectContaining({
            headers: {
              Authorization: authorization,
              'Content-Type': 'application/json'
            }
          })
        )
        expect(useAuthStore().getFirebaseAuthHeader).toHaveBeenCalledTimes(
          firebaseCalls
        )
        windowOpenSpy.mockRestore()
      }
    )

    it('rejects with the mint failure and sends no checkout request', async () => {
      vi.mocked(webSessionResourceHeader).mockRejectedValue(
        new SessionTokenError({
          status: 'error',
          code: 'SESSION_REVOKED',
          retryable: false
        })
      )

      await expect(
        useSubscriptionWithScope().subscribeDirect()
      ).rejects.toMatchObject({
        failure: { code: 'SESSION_REVOKED' }
      })
      expect(global.fetch).not.toHaveBeenCalled()
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
      expect(stored.previous_cancel_at).toBeUndefined()
      expect(stored.owner_id).toBe('user-123')
      expect(stored.workspace_id).toBe('workspace-123')

      windowOpenSpy.mockRestore()
    })

    it.for([
      {
        name: 'the checkout request is rejected',
        checkoutResponse: () =>
          ({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({ message: 'declined' }),
            text: async () => ''
          }) as Response,
        openedWindow: window,
        rejection: 'Failed to initiate subscription',
        failure: { failure_category: 'api_rejected' }
      },
      {
        name: 'no checkout URL comes back',
        checkoutResponse: () => new Response(JSON.stringify({})),
        openedWindow: window,
        rejection: 'No checkout URL returned',
        failure: {
          failure_category: 'unknown',
          error_code: 'missing_checkout_response'
        }
      },
      {
        name: 'the browser blocks the checkout tab',
        checkoutResponse: () =>
          new Response(
            JSON.stringify({ checkout_url: 'https://checkout.stripe.com/x' })
          ),
        openedWindow: null,
        rejection: "Couldn't open the payment page",
        failure: {
          failure_category: 'redirect',
          error_code: 'payment_popup_blocked'
        }
      }
    ])(
      'closes a resubscribe checkout that never opened with one failure: $name',
      async ({ checkoutResponse, openedWindow, rejection, failure }) => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue(
          '00000000-0000-4000-8000-000000000005'
        )
        vi.mocked(global.fetch).mockResolvedValue(checkoutResponse())
        vi.spyOn(window, 'open').mockImplementation(() => openedWindow)

        await expect(
          useSubscriptionWithScope().subscribeDirect({
            operation: 'resubscribe',
            source: 'settings_billing_panel'
          })
        ).rejects.toThrow(rejection)

        const attemptEvent = {
          operation: 'subscription_checkout',
          checkout_attempt_id: '00000000-0000-4000-8000-000000000005',
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        }
        expect(mockTelemetry.trackBillingEvent.mock.calls).toEqual([
          [{ ...attemptEvent, stage: 'started', outcome: 'pending' }],
          [
            {
              ...attemptEvent,
              stage: 'failed',
              outcome: 'failure',
              ...failure,
              duration_ms: expect.any(Number)
            }
          ]
        ])
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      }
    )
  })

  describe('pending checkout recovery', () => {
    it('evicts a hung bootstrap read before retrying recovery', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-hung-bootstrap',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockImplementation(
        () => new Promise(() => undefined)
      )
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(10_000)
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      await vi.advanceTimersByTimeAsync(3_000)

      expect(mockGetBillingStatus).toHaveBeenCalledTimes(2)
    })

    it('coalesces paired lifecycle recovery events', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-paired-events',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockImplementation(
        () => new Promise(() => undefined)
      )
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      window.dispatchEvent(new Event('pageshow'))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockGetBillingStatus).toHaveBeenCalledOnce()
    })

    it('does not report while the checkout could still plausibly complete', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-in-progress',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      window.dispatchEvent(new Event('pageshow'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockReportTelemetryError).not.toHaveBeenCalled()
    })

    it('reports once when a checkout has missed its completion deadline', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-timeout',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      window.dispatchEvent(new Event('pageshow'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_completing_cloud_checkout',
          context: expect.objectContaining({
            checkout_attempt_id: 'attempt-timeout',
            attempt_age_ms: expect.any(Number)
          })
        })
      )
      const [, options] = mockReportTelemetryError.mock.calls[0]
      expect(options.context.attempt_age_ms).toBeGreaterThanOrEqual(
        10 * 60 * 1000
      )
    })

    it('preserves but does not consume a pending checkout owned by another account', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-other-owner',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new',
          owner_id: 'user-previous',
          workspace_id: 'workspace-123'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '',
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY'
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).not.toBeNull()
      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).not.toHaveBeenCalled()
      expect(mockReportTelemetryError).not.toHaveBeenCalled()
    })

    it('reports an abandoned plan change while the previous tier stays active', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-plan-change-timeout',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '',
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY'
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_completing_cloud_checkout',
          context: expect.objectContaining({
            checkout_attempt_id: 'attempt-plan-change-timeout'
          })
        })
      )
    })

    it('times out the billing funnel when the completion never lands', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-funnel',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      window.dispatchEvent(new Event('pageshow'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'timeout',
          outcome: 'failure',
          failure_category: 'poll_timeout',
          checkout_type: 'new',
          checkout_attempt_id: 'attempt-funnel'
        })
      )
    })

    it('closes the resubscribe funnel when its checkout times out', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-resubscribe-timeout',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new',
          operation: 'resubscribe',
          resubscribe_source: 'pricing_dialog',
          previous_cancel_at: '2025-11-16'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: 'pricing_dialog',
        checkout_attempt_id: 'attempt-resubscribe-timeout',
        failure_category: 'poll_timeout'
      })
    })

    it('emits eventual success after the same attempt timed out', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-late-success',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      const { fetchStatus } = useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '',
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY'
      })
      await fetchStatus()

      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          checkout_attempt_id: 'attempt-late-success',
          recovery_outcome: 'late_success'
        })
      )
      expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'succeeded',
          outcome: 'success',
          checkout_attempt_id: 'attempt-late-success',
          recovery_outcome: 'late_success'
        })
      )
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
    })

    it('reports at the deadline without another lifecycle event', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-wakeup',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      expect(mockReportTelemetryError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(556_999)
      expect(mockReportTelemetryError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)

      expect(mockReportTelemetryError).toHaveBeenCalledOnce()
      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_completing_cloud_checkout',
          context: expect.objectContaining({
            checkout_attempt_id: 'attempt-wakeup'
          })
        })
      )
    })

    it('cancels the deadline wake-up when its scope is disposed', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-disposed',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      scope?.stop()
      scope = undefined
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(mockReportTelemetryError).not.toHaveBeenCalled()
    })

    it('does not resurrect recovery timers after disposal', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-disposed-in-flight',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      let rejectRead!: (error: Error) => void
      mockGetBillingStatus.mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectRead = reject
          })
      )
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      scope?.stop()
      scope = undefined
      rejectRead(new Error('offline after disposal'))
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(mockGetBillingStatus).toHaveBeenCalledOnce()
      expect(mockReportTelemetryError).not.toHaveBeenCalled()
    })

    it('does not publish an in-flight status read after disposal', async () => {
      let resolveRead!: (status: BillingStatusResponse) => void
      mockGetBillingStatus.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRead = resolve
        })
      )
      mockIsLoggedIn.value = true

      const { subscriptionStatus } = useSubscriptionWithScope()
      scope?.stop()
      scope = undefined
      resolveRead(buildStatus({ is_active: true, renewal_date: 'too-late' }))
      await vi.advanceTimersByTimeAsync(0)

      expect(subscriptionStatus.value).toBeNull()
      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).not.toHaveBeenCalled()
    })

    it('stops polling after the unavailable deadline retry ladder', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-retry-cap',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue(undefined)
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000 + 1_056_000)
      expect(mockGetBillingStatus).toHaveBeenCalledTimes(10)

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(mockGetBillingStatus).toHaveBeenCalledTimes(10)
      expect(mockTelemetry.trackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'timeout' })
      )
    })

    it('re-arms the deadline wake-up across a transient cloud change', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-transient-cloud',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(599_000)
      mockIsCloud.value = false
      await vi.advanceTimersByTimeAsync(1_000)
      expect(mockReportTelemetryError).not.toHaveBeenCalled()

      mockIsCloud.value = true
      await vi.advanceTimersByTimeAsync(1_000)

      expect(mockReportTelemetryError).toHaveBeenCalledOnce()
    })

    it('rechecks billing at the deadline before reporting', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-completed-before-deadline',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: false,
        renewal_date: '',
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY'
      })
      await vi.advanceTimersByTimeAsync(557_000)

      expect(mockReportTelemetryError).not.toHaveBeenCalled()
      expect(mockTelemetry.trackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'failed' })
      )
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
    })

    it('bounds a deadline refresh that never settles', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-hung-deadline-refresh',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      mockGetBillingStatus.mockImplementation(
        () => new Promise(() => undefined)
      )

      await vi.advanceTimersByTimeAsync(557_000)
      expect(mockReportTelemetryError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(10_000)

      expect(
        mockReportTelemetryError.mock.calls.map(
          ([, options]) => options.errorType
        )
      ).toEqual(expect.arrayContaining(['failure_recovering_cloud_checkout']))
      expect(
        mockReportTelemetryError.mock.calls.every(
          ([, options]) =>
            options.errorType === 'failure_recovering_cloud_checkout'
        )
      ).toBe(true)
      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_recovering_cloud_checkout',
          context: expect.objectContaining({
            checkout_attempt_id: 'attempt-hung-deadline-refresh'
          })
        })
      )
    })

    it('bounds a lifecycle recovery already running at the deadline', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-hung-before-deadline',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      await vi.advanceTimersByTimeAsync(556_000)

      mockGetBillingStatus.mockImplementation(
        () => new Promise(() => undefined)
      )
      window.dispatchEvent(new Event('pageshow'))
      await vi.advanceTimersByTimeAsync(1_000)
      expect(mockReportTelemetryError).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(10_000)

      expect(
        mockReportTelemetryError.mock.calls.map(
          ([, options]) => options.errorType
        )
      ).toEqual(expect.arrayContaining(['failure_recovering_cloud_checkout']))
      expect(
        mockReportTelemetryError.mock.calls.every(
          ([, options]) =>
            options.errorType === 'failure_recovering_cloud_checkout'
        )
      ).toBe(true)
      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_recovering_cloud_checkout',
          context: expect.objectContaining({
            checkout_attempt_id: 'attempt-hung-before-deadline'
          })
        })
      )
    })

    it('records one unreachable terminal when billing misses the deadline', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-recovered-reachable',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      // Fail every attempt up to the last rung, so the flag is set, then let the
      // call that exhausts the ladder reach billing successfully.
      mockGetBillingStatus.mockRejectedValue(new Error('offline'))
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(13_000)

      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      await vi.advanceTimersByTimeAsync(30_000)

      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_recovering_cloud_checkout'
        })
      )
      expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'subscription_checkout',
          stage: 'failed',
          checkout_attempt_id: 'attempt-recovered-reachable',
          failure_category: 'network'
        })
      )
      expect(
        mockReportTelemetryError.mock.calls.map(
          ([, options]) => options.errorType
        )
      ).toEqual(['failure_recovering_cloud_checkout'])
    })

    it('lets any reachable billing read clear a past network failure', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-reachable-elsewhere',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockRejectedValue(new Error('offline'))
      mockIsLoggedIn.value = true

      const { fetchStatus } = useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      // Billing comes back, but the deadline wake-up is already armed, so no
      // further recovery attempt runs before it fires. A plain status read from
      // the billing UI is the only thing that observes billing is reachable.
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      await fetchStatus()
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

      expect(mockReportTelemetryError).toHaveBeenCalledOnce()
      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_completing_cloud_checkout'
        })
      )
    })

    it('reports a missing completion once per attempt across reloads', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-reload',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      expect(mockReportTelemetryError).toHaveBeenCalledOnce()
      expect(
        JSON.parse(
          localStorage.getItem(
            'comfy.subscription.pending_checkout_terminal'
          ) ?? 'null'
        )
      ).toEqual({
        attempt_id: 'attempt-reload',
        terminal: 'completion_missing'
      })

      // A reload drops all composable state but keeps the stored attempt.
      scope?.stop()
      scope = effectScope()
      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      expect(mockReportTelemetryError).toHaveBeenCalledOnce()
      expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledOnce()
    })

    it('separates an unreachable billing API from a missing completion', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-offline',
          started_at_ms: Date.now() - 11 * 60 * 1000,
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockRejectedValue(new Error('offline'))
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)
      window.dispatchEvent(new Event('pageshow'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockReportTelemetryError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'failure_recovering_cloud_checkout'
        })
      )
    })

    it('ignores a deadline failure after its attempt is replaced', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-replaced',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(43_000)

      let rejectDeadlineRead: (reason: Error) => void = () => undefined
      mockGetBillingStatus.mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectDeadlineRead = reject
        })
      )
      await vi.advanceTimersByTimeAsync(557_000)
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-current',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      rejectDeadlineRead(new Error('offline'))
      await vi.advanceTimersByTimeAsync(0)

      expect(mockReportTelemetryError).not.toHaveBeenCalled()
      expect(mockTelemetry.trackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ checkout_attempt_id: 'attempt-current' })
      )
    })

    it('does not let a replaced attempt read consume the current attempt', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-replaced-success',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      let resolveReplacedRead: (status: BillingStatusResponse) => void = () =>
        undefined
      mockGetBillingStatus.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReplacedRead = resolve
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(0)
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-current-success',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      window.dispatchEvent(
        new Event('comfy:subscription-checkout-attempt-changed')
      )
      resolveReplacedRead(
        buildStatus({
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        })
      )
      await vi.advanceTimersByTimeAsync(0)

      expect(
        JSON.parse(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) ??
            'null'
        )
      ).toMatchObject({ attempt_id: 'attempt-current-success' })
      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).not.toHaveBeenCalled()
    })

    it('does not report a missing completion after recovery succeeds', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-recovered',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockGetBillingStatus
        .mockResolvedValueOnce({
          is_active: false,
          has_funds: false,
          renewal_date: ''
        })
        .mockResolvedValue({
          is_active: true,
          has_funds: true,
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY',
          renewal_date: '2025-11-16'
        })
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()
      await vi.runAllTimersAsync()

      expect(mockReportTelemetryError).not.toHaveBeenCalled()
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
    })

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
          resubscribe_source: 'pricing_dialog',
          previous_cancel_at: '2025-11-16'
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
          source: 'pricing_dialog',
          checkout_attempt_id: 'attempt-789'
        })
      })
    })

    it('does not complete resubscribe while the cancellation marker is unchanged', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-resubscribe-unchanged',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new',
          operation: 'resubscribe',
          resubscribe_source: 'pricing_dialog',
          previous_cancel_at: '2025-11-16'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'MONTHLY',
        cancel_at: '2025-11-16',
        renewal_date: '2025-11-16'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(0)

      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).not.toHaveBeenCalled()
      expect(mockTelemetry.trackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'resubscribe',
          stage: 'succeeded'
        })
      )
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).not.toBeNull()
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
      expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'resubscribe' })
      )
    })

    async function openCheckoutThenConfirm(
      open: (subscription: ReturnType<typeof useSubscription>) => Promise<void>,
      activeStatus: Partial<BillingStatusResponse>
    ) {
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(
        '00000000-0000-4000-8000-000000000003'
      )
      vi.spyOn(window, 'open').mockImplementation(() => window)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: 'https://checkout.stripe.com/test' })
      } as Response)
      useCurrentUser().isLoggedIn = computed(() => true)
      const subscription = useSubscriptionWithScope()
      await subscription.fetchStatus()

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16',
        ...activeStatus
      })
      await open(subscription)
      await subscription.fetchStatus()
      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      })
    }

    it.for([
      {
        name: 'performSubscriptionCheckout reported the start, so it closes with one success',
        open: () =>
          performSubscriptionCheckout('creator', 'yearly', {
            paymentIntentSource: 'out_of_credits'
          }),
        activeStatus: {
          subscription_tier: 'CREATOR',
          subscription_duration: 'ANNUAL'
        } satisfies Partial<BillingStatusResponse>,
        expectedEvents: [
          [
            {
              operation: 'subscription_checkout',
              stage: 'started',
              outcome: 'pending',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000003',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'new',
              payment_intent_source: 'out_of_credits'
            }
          ],
          [
            {
              operation: 'subscription_checkout',
              stage: 'succeeded',
              outcome: 'success',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000003',
              tier: 'creator',
              cycle: 'yearly',
              checkout_type: 'new',
              payment_intent_source: 'out_of_credits',
              duration_ms: expect.any(Number)
            }
          ]
        ]
      },
      {
        name: 'subscribeDirect reported the start, so it closes with one success',
        open: (subscription: ReturnType<typeof useSubscription>) =>
          subscription.subscribeDirect(),
        activeStatus: {
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        } satisfies Partial<BillingStatusResponse>,
        expectedEvents: [
          [
            {
              operation: 'subscription_checkout',
              stage: 'started',
              outcome: 'pending',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000003',
              tier: 'standard',
              cycle: 'monthly',
              checkout_type: 'new'
            }
          ],
          [
            {
              operation: 'subscription_checkout',
              stage: 'succeeded',
              outcome: 'success',
              checkout_attempt_id: '00000000-0000-4000-8000-000000000003',
              tier: 'standard',
              cycle: 'monthly',
              checkout_type: 'new',
              duration_ms: expect.any(Number)
            }
          ]
        ]
      }
    ])(
      'closes a confirmed checkout only in the funnel it opened: $name',
      async ({ open, activeStatus, expectedEvents }) => {
        await openCheckoutThenConfirm(open, activeStatus)

        expect(mockTelemetry.trackBillingEvent.mock.calls).toEqual(
          expectedEvents
        )
      }
    )

    it('keeps the start marker out of the monthly_subscription_succeeded payload', async () => {
      await openCheckoutThenConfirm(
        () =>
          performSubscriptionCheckout('creator', 'yearly', {
            paymentIntentSource: 'out_of_credits'
          }),
        { subscription_tier: 'CREATOR', subscription_duration: 'ANNUAL' }
      )

      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded.mock.calls
      ).toEqual([
        [
          {
            user_id: 'user-123',
            checkout_attempt_id: '00000000-0000-4000-8000-000000000003',
            tier: 'creator',
            cycle: 'yearly',
            checkout_type: 'new',
            payment_intent_source: 'out_of_credits',
            value: 336,
            currency: 'USD',
            ecommerce: {
              value: 336,
              currency: 'USD',
              items: [
                {
                  item_name: 'creator',
                  item_category: 'subscription',
                  item_variant: 'yearly',
                  price: 336,
                  quantity: 1
                }
              ]
            }
          }
        ]
      ])
    })

    it.for([
      {
        name: 'an attempt that never reported a start reports none',
        attempt: {
          attempt_id: 'attempt-change',
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'creator'
        },
        status: { subscription_tier: 'PRO', subscription_duration: 'MONTHLY' },
        expectedEvents: []
      },
      {
        name: 'a resubscribe closes only its own funnel',
        attempt: {
          attempt_id: 'attempt-resubscribe',
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new',
          operation: 'resubscribe',
          resubscribe_source: 'pricing_dialog',
          previous_cancel_at: '2025-11-16'
        },
        status: {
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY'
        },
        expectedEvents: [
          [
            {
              operation: 'resubscribe',
              stage: 'succeeded',
              outcome: 'success',
              source: 'pricing_dialog',
              checkout_attempt_id: 'attempt-resubscribe'
            }
          ]
        ]
      }
    ])(
      'reports a timely success to the funnel that opened it: $name',
      async ({ attempt, status, expectedEvents }) => {
        localStorage.setItem(
          PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
          JSON.stringify({ ...attempt, started_at_ms: Date.now() })
        )
        mockGetBillingStatus.mockResolvedValue({
          is_active: true,
          has_funds: true,
          renewal_date: '2025-11-16',
          ...status
        })

        useCurrentUser().isLoggedIn = computed(() => true)
        useSubscriptionWithScope()

        await vi.waitFor(() => {
          expect(
            localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
          ).toBeNull()
        })
        expect(mockTelemetry.trackBillingEvent.mock.calls).toEqual(
          expectedEvents
        )
      }
    )

    it('still reports a late success for a plan change after its timeout', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-late-change',
          started_at_ms: Date.now(),
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'creator'
        })
      )
      claimPendingCheckoutTerminal('attempt-late-change', 'completion_missing')
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16',
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      })
      expect(mockTelemetry.trackBillingEvent.mock.calls).toEqual([
        [
          {
            operation: 'subscription_checkout',
            stage: 'succeeded',
            outcome: 'success',
            checkout_attempt_id: 'attempt-late-change',
            tier: 'pro',
            cycle: 'monthly',
            checkout_type: 'change',
            recovery_outcome: 'late_success',
            duration_ms: expect.any(Number)
          }
        ]
      ])
    })

    it('measures a reported success from the attempt start', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-measured',
          started_at_ms: Date.now() - 90_000,
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'creator',
          start_reported: true
        })
      )
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16',
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY'
      })

      useCurrentUser().isLoggedIn = computed(() => true)
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      })
      expect(mockTelemetry.trackBillingEvent.mock.calls).toEqual([
        [
          {
            operation: 'subscription_checkout',
            stage: 'succeeded',
            outcome: 'success',
            checkout_attempt_id: 'attempt-measured',
            tier: 'pro',
            cycle: 'monthly',
            checkout_type: 'change',
            duration_ms: expect.any(Number)
          }
        ]
      ])
      const [[succeeded]] = mockTelemetry.trackBillingEvent.mock.calls
      expect(succeeded.duration_ms).toBeGreaterThanOrEqual(90_000)
      expect(succeeded.duration_ms).toBeLessThan(120_000)
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

    it('clears pending checkout attempts after logout', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-reactive-logout',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )
      mockIsLoggedIn.value = true
      useSubscriptionWithScope()
      await vi.advanceTimersByTimeAsync(0)

      mockIsLoggedIn.value = false

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
    it('should open usage history URL in the active workspace', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'ws-team-1'
      })

      const { handleViewUsageHistory } = useSubscriptionWithScope()
      handleViewUsageHistory()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://stagingplatform.comfy.org/profile/usage?workspace=ws-team-1',
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

    it('should open the billing portal for invoice history', async () => {
      const { handleInvoiceHistory } = useSubscriptionWithScope()

      await handleInvoiceHistory()

      expect(useAuthActions().accessBillingPortalDirect).toHaveBeenCalled()
    })

    it('should open the billing portal for manage subscription', async () => {
      const { manageSubscription } = useSubscriptionWithScope()

      await manageSubscription()

      expect(useAuthActions().accessBillingPortalDirect).toHaveBeenCalled()
    })

    describe('portal telemetry', () => {
      type PortalAction = 'manageSubscription' | 'handleInvoiceHistory'

      function portalEvents() {
        return mockTelemetry.trackBillingEvent.mock.calls
          .map(([event]) => event)
          .filter((event) => event.operation === 'portal')
      }

      function leaveAndReturn() {
        window.dispatchEvent(new Event('blur'))
        window.dispatchEvent(new Event('focus'))
      }

      beforeEach(() => {
        mockTelemetry.trackBillingEvent.mockClear()
      })

      it.for<{ action: PortalAction; target: string }>([
        { action: 'manageSubscription', target: 'manage_subscription' },
        { action: 'handleInvoiceHistory', target: 'invoices' }
      ])(
        'reports $action opening the portal and one return',
        async ({ action, target }) => {
          await useSubscriptionWithScope()[action]()
          leaveAndReturn()
          leaveAndReturn()

          expect(portalEvents()).toEqual([
            {
              operation: 'portal',
              stage: 'opened',
              outcome: 'pending',
              target,
              billing_client: 'legacy'
            },
            {
              operation: 'portal',
              stage: 'returned',
              outcome: 'pending',
              target,
              billing_client: 'legacy'
            }
          ])
        }
      )

      it.for<{ action: PortalAction; target: string }>([
        { action: 'manageSubscription', target: 'manage_subscription' },
        { action: 'handleInvoiceHistory', target: 'invoices' }
      ])(
        'reports $action as a failed open when the tab is blocked',
        async ({ action, target }) => {
          mockAccessBillingPortal.mockResolvedValueOnce(false)

          await useSubscriptionWithScope()[action]()
          leaveAndReturn()

          expect(portalEvents()).toEqual([
            {
              operation: 'portal',
              stage: 'failed',
              outcome: 'failure',
              target,
              billing_client: 'legacy',
              failure_category: 'redirect',
              error_code: 'payment_popup_blocked'
            }
          ])
        }
      )

      it('reports a refused portal request as a failed open and still reports the error', async () => {
        const refusal = new AuthStoreError('Portal refused', 500)
        mockAccessBillingPortal.mockRejectedValueOnce(refusal)

        await expect(
          useSubscriptionWithScope().manageSubscription()
        ).rejects.toBe(refusal)

        expect(portalEvents()).toEqual([
          {
            operation: 'portal',
            stage: 'failed',
            outcome: 'failure',
            target: 'manage_subscription',
            billing_client: 'legacy',
            failure_category: 'api_rejected'
          }
        ])
        expect(mockReportError).toHaveBeenCalledWith(refusal)
      })
    })

    it('does not start cancellation watching when the billing portal does not open', async () => {
      useCurrentUser().isLoggedIn = computed(() => true)
      vi.mocked(
        useAuthActions().accessBillingPortalDirect
      ).mockResolvedValueOnce(false)

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

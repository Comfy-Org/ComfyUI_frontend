import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  BillingRail,
  BillingStatusResponse,
  Plan
} from '@/platform/workspace/api/workspaceApi'

import { useBillingContext } from './useBillingContext'

const DEFAULT_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  max_seats: 73,
  occupied_seats: 72,
  has_funds: true,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY'
}

const {
  mockTeamWorkspacesEnabled,
  mockConsolidatedBillingEnabled,
  mockIsPersonal,
  mockBillingRail,
  mockPlans,
  mockFetchPlans,
  mockLegacyFetchStatus,
  mockLegacyFetchBalance,
  mockLegacySubscribe,
  mockPurchaseCredits,
  mockUpdateActiveWorkspace,
  mockSetWorkspaceBillingRail,
  mockBillingStatus
} = vi.hoisted(() => ({
  mockTeamWorkspacesEnabled: { value: false },
  mockConsolidatedBillingEnabled: { value: false },
  mockIsPersonal: { value: true },
  mockBillingRail: { value: undefined as BillingRail | undefined },
  mockPlans: { value: [] as Plan[] },
  mockFetchPlans: vi.fn().mockResolvedValue(undefined),
  mockLegacyFetchStatus: vi.fn().mockResolvedValue(undefined),
  mockLegacyFetchBalance: vi.fn().mockResolvedValue(undefined),
  mockLegacySubscribe: vi.fn().mockResolvedValue(undefined),
  mockPurchaseCredits: vi.fn(),
  mockUpdateActiveWorkspace: vi.fn(),
  mockSetWorkspaceBillingRail: vi.fn(),
  mockBillingStatus: {
    value: {
      is_active: true,
      has_funds: true,
      subscription_tier: 'PRO',
      subscription_duration: 'MONTHLY'
    } as Partial<BillingStatusResponse>
  }
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...(original as Record<string, unknown>),
    createSharedComposable: (fn: (...args: unknown[]) => unknown) => fn
  }
})

vi.mock('@/composables/useFeatureFlags', async () => {
  const { ref } = await import('vue')
  const teamWorkspacesEnabledRef = ref(mockTeamWorkspacesEnabled.value)
  Object.defineProperty(mockTeamWorkspacesEnabled, 'value', {
    get: () => teamWorkspacesEnabledRef.value,
    set: (value: boolean) => {
      teamWorkspacesEnabledRef.value = value
    }
  })
  const consolidatedBillingEnabledRef = ref(
    mockConsolidatedBillingEnabled.value
  )
  Object.defineProperty(mockConsolidatedBillingEnabled, 'value', {
    get: () => consolidatedBillingEnabledRef.value,
    set: (value: boolean) => {
      consolidatedBillingEnabledRef.value = value
    }
  })
  return {
    useFeatureFlags: () => ({
      flags: {
        get teamWorkspacesEnabled() {
          return mockTeamWorkspacesEnabled.value
        },
        get consolidatedBillingEnabled() {
          return mockConsolidatedBillingEnabled.value
        }
      }
    })
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', async () => {
  const { ref } = await import('vue')
  const billingRailRef = ref(mockBillingRail.value)
  Object.defineProperty(mockBillingRail, 'value', {
    get: () => billingRailRef.value,
    set: (value: BillingRail | undefined) => {
      billingRailRef.value = value
    }
  })
  return {
    useTeamWorkspaceStore: () => ({
      get isInPersonalWorkspace() {
        return mockIsPersonal.value
      },
      get activeWorkspace() {
        return mockIsPersonal.value
          ? { id: 'personal-123', type: 'personal' }
          : { id: 'team-456', type: 'team' }
      },
      get activeWorkspaceBillingRail() {
        return mockBillingRail.value
      },
      updateActiveWorkspace: mockUpdateActiveWorkspace,
      setWorkspaceBillingRail: mockSetWorkspaceBillingRail
    })
  }
})

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isActiveSubscription: { value: true },
    subscriptionTier: { value: 'PRO' },
    subscriptionDuration: { value: 'MONTHLY' },
    subscriptionStatus: {
      value: { renewal_date: '2025-01-01T00:00:00Z', end_date: null }
    },
    isCancelled: { value: false },
    fetchStatus: mockLegacyFetchStatus,
    manageSubscription: vi.fn().mockResolvedValue(undefined),
    subscribe: mockLegacySubscribe,
    showSubscriptionDialog: vi.fn()
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      show: vi.fn(),
      hide: vi.fn()
    })
  })
)

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    purchaseCredits: mockPurchaseCredits
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    balance: { amount_micros: 5000000 },
    fetchBalance: mockLegacyFetchBalance
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useBillingPlans', () => ({
  useBillingPlans: () => ({
    get plans() {
      return mockPlans
    },
    currentPlanSlug: { value: null },
    isLoading: { value: false },
    error: { value: null },
    fetchPlans: mockFetchPlans,
    getPlanBySlug: vi.fn().mockReturnValue(null)
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingStatus: vi.fn(() =>
      Promise.resolve({ ...DEFAULT_BILLING_STATUS, ...mockBillingStatus.value })
    ),
    getBillingBalance: vi.fn().mockResolvedValue({
      amount_micros: 10000000,
      currency: 'usd'
    }),
    subscribe: vi.fn().mockResolvedValue({ status: 'subscribed' }),
    previewSubscribe: vi.fn().mockResolvedValue({ allowed: true })
  }
}))

describe('useBillingContext', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockTeamWorkspacesEnabled.value = false
    mockConsolidatedBillingEnabled.value = false
    mockIsPersonal.value = true
    mockBillingRail.value = undefined
    mockSetWorkspaceBillingRail.mockImplementation(
      (_workspaceId: string, billingRail: BillingRail) => {
        mockBillingRail.value = billingRail
      }
    )
    mockPlans.value = []
    mockBillingStatus.value = { ...DEFAULT_BILLING_STATUS }
  })

  it('selects legacy type when team workspaces are disabled', () => {
    mockTeamWorkspacesEnabled.value = false
    const { type } = useBillingContext()
    expect(type.value).toBe('legacy')
  })

  it('keeps personal on legacy when consolidated billing is disabled', () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = false
    mockIsPersonal.value = true

    const { type } = useBillingContext()
    expect(type.value).toBe('legacy')
  })

  it('selects workspace type for personal when consolidated billing is enabled', () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = true
    mockIsPersonal.value = true

    const { type } = useBillingContext()
    expect(type.value).toBe('workspace')
  })

  it('selects workspace type for team regardless of consolidated billing', () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = false
    mockIsPersonal.value = false

    const { type } = useBillingContext()
    expect(type.value).toBe('workspace')
  })

  it('provides subscription info from legacy billing', () => {
    const { subscription } = useBillingContext()

    expect(subscription.value).toEqual({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      renewalDate: '2025-01-01T00:00:00Z',
      endDate: null,
      isCancelled: false,
      hasFunds: true
    })
  })

  it('provides balance info from legacy billing', () => {
    const { balance } = useBillingContext()

    expect(balance.value).toEqual({
      amountMicros: 5000000,
      currency: 'usd',
      effectiveBalanceMicros: 5000000,
      prepaidBalanceMicros: 0,
      cloudCreditBalanceMicros: 0
    })
  })

  it('exposes initialize action', async () => {
    const { initialize } = useBillingContext()
    await expect(initialize()).resolves.toBeUndefined()
  })

  it('exposes fetchStatus action', async () => {
    const { fetchStatus } = useBillingContext()
    await expect(fetchStatus()).resolves.toBeUndefined()
  })

  it('exposes fetchBalance action', async () => {
    const { fetchBalance } = useBillingContext()
    await expect(fetchBalance()).resolves.toBeUndefined()
  })

  it('exposes subscribe action', async () => {
    const { subscribe } = useBillingContext()
    await expect(subscribe('pro-monthly')).resolves.toBeUndefined()
  })

  it('exposes manageSubscription action', async () => {
    const { manageSubscription } = useBillingContext()
    await expect(manageSubscription()).resolves.toBeUndefined()
  })

  it('converts topup cents to whole dollars for the legacy credit endpoint', async () => {
    const { topup } = useBillingContext()
    await topup(500)

    expect(mockPurchaseCredits).toHaveBeenCalledWith(5)
  })

  it('uses workspace checkout while keeping legacy topups on legacy Stripe', async () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = true
    mockBillingRail.value = 'legacy_stripe'
    mockPlans.value = [
      {
        slug: 'creator-annual',
        tier: 'CREATOR',
        duration: 'ANNUAL',
        price_cents: 33600,
        credits_cents: 42086,
        max_seats: 1,
        availability: { available: true },
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 33600,
          total_credits_cents: 42086
        }
      }
    ]

    const context = useBillingContext()
    vi.clearAllMocks()

    expect(context.type.value).toBe('legacy')
    expect(context.plans.value).toEqual(mockPlans.value)

    await context.fetchPlans()
    await context.fetchStatus()

    expect(mockFetchPlans).toHaveBeenCalledOnce()
    expect(mockLegacyFetchStatus).toHaveBeenCalledOnce()
    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()

    await context.previewSubscribe('creator-annual')
    await context.subscribe('creator-annual')
    await context.topup(500)

    expect(workspaceApi.previewSubscribe).toHaveBeenCalledWith(
      'creator-annual',
      undefined
    )
    expect(workspaceApi.subscribe).toHaveBeenCalledWith(
      'creator-annual',
      undefined
    )
    expect(mockLegacySubscribe).not.toHaveBeenCalled()
    expect(mockPurchaseCredits).toHaveBeenCalledWith(5)
  })

  it('switches billing adapters before refreshing a migrated balance', async () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = true
    mockBillingRail.value = 'legacy_stripe'
    mockBillingStatus.value = {
      ...DEFAULT_BILLING_STATUS,
      billing_rail: 'stripe'
    }

    const context = useBillingContext()
    vi.clearAllMocks()

    await context.reconcileSubscriptionSuccess()

    expect(mockSetWorkspaceBillingRail).toHaveBeenCalledWith(
      'personal-123',
      'stripe'
    )
    expect(context.type.value).toBe('workspace')
    expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
    expect(workspaceApi.getBillingBalance).toHaveBeenCalled()
    expect(mockLegacyFetchStatus).not.toHaveBeenCalled()
    expect(mockLegacyFetchBalance).not.toHaveBeenCalled()
  })

  it('does not refresh a balance through a stale rail after discovery fails', async () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = true
    mockBillingRail.value = 'legacy_stripe'

    const context = useBillingContext()
    vi.clearAllMocks()
    vi.mocked(workspaceApi.getBillingStatus).mockRejectedValueOnce(
      new Error('status unavailable')
    )

    await expect(context.reconcileSubscriptionSuccess()).rejects.toThrow(
      'status unavailable'
    )

    expect(workspaceApi.getBillingBalance).not.toHaveBeenCalled()
    expect(mockLegacyFetchBalance).not.toHaveBeenCalled()
  })

  it('rejects topup amounts that are not positive whole-dollar cents', async () => {
    const { topup } = useBillingContext()
    await expect(topup(550)).rejects.toThrow()
    await expect(topup(0)).rejects.toThrow()
    await expect(topup(-100)).rejects.toThrow()
    await expect(topup(99.5)).rejects.toThrow()
  })

  it('provides isActiveSubscription convenience computed', () => {
    const { isActiveSubscription } = useBillingContext()
    expect(isActiveSubscription.value).toBe(true)
  })

  it('exposes requireActiveSubscription action', async () => {
    const { requireActiveSubscription } = useBillingContext()
    await expect(requireActiveSubscription()).resolves.toBeUndefined()
  })

  it('exposes showSubscriptionDialog action', () => {
    const { showSubscriptionDialog } = useBillingContext()
    expect(() => showSubscriptionDialog()).not.toThrow()
  })

  it('reinitializes workspace billing when the type flips on after legacy init', async () => {
    mockTeamWorkspacesEnabled.value = false
    mockIsPersonal.value = true

    const { type, initialize } = useBillingContext()
    await initialize()
    await nextTick()

    expect(type.value).toBe('legacy')
    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()

    // Authenticated remote config resolves the flag on for the same workspace
    mockConsolidatedBillingEnabled.value = true
    mockTeamWorkspacesEnabled.value = true

    await vi.waitFor(() => {
      expect(type.value).toBe('workspace')
      expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
    })
  })

  it('moves a personal workspace to workspace billing when consolidated billing flips on', async () => {
    mockTeamWorkspacesEnabled.value = true
    mockConsolidatedBillingEnabled.value = false
    mockIsPersonal.value = true

    const { type } = useBillingContext()
    await nextTick()
    expect(type.value).toBe('legacy')

    mockConsolidatedBillingEnabled.value = true

    await vi.waitFor(() => {
      expect(type.value).toBe('workspace')
      expect(workspaceApi.getBillingStatus).toHaveBeenCalled()
    })
  })

  describe('subscription mirror to workspace store', () => {
    it('mirrors subscription for personal workspaces on the consolidated billing flow', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockConsolidatedBillingEnabled.value = true
      mockIsPersonal.value = true

      const { initialize } = useBillingContext()
      await initialize()
      await nextTick()

      expect(mockUpdateActiveWorkspace).toHaveBeenCalledWith({
        isSubscribed: true,
        subscriptionPlan: null
      })
    })

    it('never clobbers the list-derived store when a subscription is absent', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false

      const { initialize } = useBillingContext()
      await initialize()
      await nextTick()

      expect(mockUpdateActiveWorkspace).not.toHaveBeenCalledWith({
        isSubscribed: false,
        subscriptionPlan: null
      })
    })
  })

  describe('getMaxSeats', () => {
    it('returns 1 for personal workspaces regardless of tier', () => {
      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('standard')).toBe(1)
      expect(getMaxSeats('creator')).toBe(1)
      expect(getMaxSeats('pro')).toBe(1)
      expect(getMaxSeats('founder')).toBe(1)
    })

    it('falls back to hardcoded values when no API plans available', () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false

      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('standard')).toBe(1)
      expect(getMaxSeats('creator')).toBe(5)
      expect(getMaxSeats('pro')).toBe(20)
      expect(getMaxSeats('founder')).toBe(1)
    })

    it('prefers API max_seats when plans are loaded', () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockPlans.value = [
        {
          slug: 'pro-monthly',
          tier: 'PRO',
          duration: 'MONTHLY',
          price_cents: 10000,
          credits_cents: 2110000,
          max_seats: 50,
          availability: { available: true },
          seat_summary: {
            seat_count: 1,
            total_cost_cents: 10000,
            total_credits_cents: 2110000
          }
        }
      ]

      const { getMaxSeats } = useBillingContext()
      expect(getMaxSeats('pro')).toBe(50)
      // Tiers without API plans still fall back to hardcoded values
      expect(getMaxSeats('creator')).toBe(5)
    })
  })

  describe('isLegacyTeamPlan', () => {
    it('is false for a personal workspace', () => {
      const { isLegacyTeamPlan } = useBillingContext()
      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is true for an active team plan: team- slug and no credit stop', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is true for any legacy team tier, not just standard', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-pro-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is false for a new credit-slider team subscriber', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      // Real BE shape: underscore slug + populated credit stop. (subscription_tier
      // is 'TEAM' on the wire, not yet in the FE SubscriptionTier union, so it is
      // omitted here — the predicate does not depend on it.)
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 147700,
          stop_usd: 700
        }
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is false for a new team sub even before its credit stop is populated', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      // Provisioning lag: credit stop not yet attached. The underscore slug
      // (team_per_credit, not team-) must still exclude it from the legacy table.
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('is false for a team workspace on a personal-tier plan', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'standard-annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('stays true for a cancelled-but-still-active legacy team sub', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'canceled',
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team-standard-annual',
        cancel_at: '2099-01-01T00:00:00Z'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })

    it('is false for a FREE-tier team even on a team- prefixed slug', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'FREE',
        plan_slug: 'team-free'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(false)
    })

    it('matches the legacy slug case-insensitively', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        subscription_duration: 'ANNUAL',
        plan_slug: 'Team-Standard-Annual'
      }

      const { initialize, isLegacyTeamPlan } = useBillingContext()
      await initialize()

      expect(isLegacyTeamPlan.value).toBe(true)
    })
  })

  describe('isTeamPlan', () => {
    it('is false for a personal workspace', () => {
      const { isTeamPlan } = useBillingContext()
      expect(isTeamPlan.value).toBe(false)
    })

    // subscription_tier is omitted throughout: the backend sends 'TEAM' here, but
    // the FE's SubscriptionTier resolves to the registry spec, which has no TEAM
    // (tierPricing.ts imports comfyRegistryTypes for what is an ingest field).
    // isTeamPlan reads the credit stop and the slug, never the tier — which is
    // what keeps it working despite that divergence.
    it('is true for a credit-slider team sub, which carries a credit stop', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        plan_slug: 'team_per_credit_monthly',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 700,
          stop_usd: 332
        }
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is true for a per-credit Team plan in a personal workspace before its credit stop is populated', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockConsolidatedBillingEnabled.value = true
      mockIsPersonal.value = true
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_duration: 'ANNUAL',
        plan_slug: 'team_per_credit_annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is true for a legacy team sub, identified by slug rather than credit stop', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'STANDARD',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    // The banner states that need isTeamPlan most — paused and payment_failed —
    // are exactly the ones the backend reports with is_active=false, because the
    // spend gate folds billing_status into it. Coupling isTeamPlan to an active
    // subscription would blank the banner precisely when it is needed.
    it('stays true for a paused team plan, which the backend reports inactive', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: false,
        has_funds: true,
        billing_status: 'paused',
        plan_slug: 'team_per_credit_monthly',
        team_credit_stop: {
          id: 'team_700',
          credits_monthly: 700,
          stop_usd: 332
        }
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('stays true for a legacy team plan whose payment failed', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: false,
        has_funds: true,
        billing_status: 'payment_failed',
        subscription_tier: 'STANDARD',
        plan_slug: 'team-standard-annual'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(true)
    })

    it('is false for a team workspace on a personal-tier plan', async () => {
      mockTeamWorkspacesEnabled.value = true
      mockIsPersonal.value = false
      mockBillingStatus.value = {
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        plan_slug: 'pro-monthly'
      }

      const { initialize, isTeamPlan } = useBillingContext()
      await initialize()

      expect(isTeamPlan.value).toBe(false)
    })
  })
})

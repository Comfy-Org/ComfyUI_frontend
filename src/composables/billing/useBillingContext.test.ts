import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from './useBillingContext'

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      teamWorkspacesEnabled: true
    }
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => {
  const isInPersonalWorkspace = { value: true }
  const activeWorkspace = { value: { id: 'personal-123', type: 'personal' } }
  return {
    useTeamWorkspaceStore: () => ({
      isInPersonalWorkspace: isInPersonalWorkspace.value,
      activeWorkspace: activeWorkspace.value,
      updateActiveWorkspace: vi.fn(),
      _setPersonalWorkspace: (value: boolean) => {
        isInPersonalWorkspace.value = value
        activeWorkspace.value = value
          ? { id: 'personal-123', type: 'personal' }
          : { id: 'team-456', type: 'team' }
      }
    })
  }
})

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isActiveSubscription: { value: true },
    subscriptionTier: { value: 'PRO' },
    subscriptionDuration: { value: 'MONTHLY' },
    formattedRenewalDate: { value: 'Jan 1, 2025' },
    formattedEndDate: { value: '' },
    isCancelled: { value: false },
    fetchStatus: vi.fn().mockResolvedValue(undefined),
    manageSubscription: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => ({
    balance: { amount_micros: 5000000 },
    fetchBalance: vi.fn().mockResolvedValue({ amount_micros: 5000000 })
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useBillingPlans', () => {
  const plans = { value: [] }
  const currentPlanSlug = { value: null }
  return {
    useBillingPlans: () => ({
      plans,
      currentPlanSlug,
      isLoading: { value: false },
      error: { value: null },
      fetchPlans: vi.fn().mockResolvedValue(undefined),
      getPlanBySlug: vi.fn().mockReturnValue(null)
    })
  }
})

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingStatus: vi.fn().mockResolvedValue({
      is_active: true,
      has_funds: true,
      subscription_tier: 'PRO',
      subscription_duration: 'MONTHLY'
    }),
    getBillingBalance: vi.fn().mockResolvedValue({
      amount_micros: 10000000,
      currency: 'usd'
    }),
    subscribe: vi.fn().mockResolvedValue({ status: 'subscribed' }),
    previewSubscribe: vi.fn().mockResolvedValue({ allowed: true }),
    getPaymentPortalUrl: vi
      .fn()
      .mockResolvedValue({ url: 'https://example.com/billing' })
  }
}))

describe('useBillingContext', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('returns workspace type for personal workspace when feature flag enabled', () => {
    const { type } = useBillingContext()
    expect(type.value).toBe('workspace')
  })

  it('provides subscription info from workspace billing', async () => {
    const { subscription, initialize } = useBillingContext()
    await initialize()

    expect(subscription.value).toEqual({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      renewalDate: null,
      endDate: null,
      isCancelled: false,
      hasFunds: true
    })
  })

  it('provides balance info from workspace billing', async () => {
    const { balance, initialize } = useBillingContext()
    await initialize()

    expect(balance.value).toEqual({
      amountMicros: 10000000,
      currency: 'usd',
      effectiveBalanceMicros: undefined,
      prepaidBalanceMicros: undefined,
      cloudCreditBalanceMicros: undefined
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
    await expect(subscribe('pro-monthly')).resolves.toBeDefined()
  })

  it('exposes manageSubscription action', async () => {
    const { manageSubscription } = useBillingContext()
    await expect(manageSubscription()).resolves.toBeUndefined()
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
})

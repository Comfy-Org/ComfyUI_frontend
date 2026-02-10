import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from './useBillingContext'

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => {
  const isInPersonalWorkspace = { value: true }
  const activeWorkspace = { value: { id: 'personal-123', type: 'personal' } }
  return {
    useTeamWorkspaceStore: () => ({
      isInPersonalWorkspace: isInPersonalWorkspace.value,
      activeWorkspace: activeWorkspace.value,
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
    previewSubscribe: vi.fn().mockResolvedValue({ allowed: true })
  }
}))

describe(useBillingContext, () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('returns legacy type for personal workspace', () => {
    const { type } = useBillingContext()
    expect(type.value).toBe('legacy')
  })

  it('provides subscription info from legacy billing', () => {
    const { subscription } = useBillingContext()

    expect(subscription.value).toEqual({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      renewalDate: 'Jan 1, 2025',
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

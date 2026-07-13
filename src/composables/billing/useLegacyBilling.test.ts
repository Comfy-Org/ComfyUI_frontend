import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLegacyBilling } from './useLegacyBilling'

const mocks = vi.hoisted(() => ({
  isActiveSubscription: { value: false },
  subscriptionTier: { value: null as string | null },
  subscriptionDuration: { value: null as string | null },
  subscriptionStatus: {
    value: null as null | {
      renewal_date?: string | null
      end_date?: string | null
    }
  },
  isCancelled: { value: false },
  fetchStatus: vi.fn(),
  manageSubscription: vi.fn(),
  subscribe: vi.fn(),
  showSubscriptionDialog: vi.fn(),
  balance: {
    value: null as null | {
      amount_micros?: number
      currency?: string
      effective_balance_micros?: number
      prepaid_balance_micros?: number
      cloud_credit_balance_micros?: number
    }
  },
  fetchBalance: vi.fn(),
  purchaseCredits: vi.fn()
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isActiveSubscription: mocks.isActiveSubscription,
    subscriptionTier: mocks.subscriptionTier,
    subscriptionDuration: mocks.subscriptionDuration,
    subscriptionStatus: mocks.subscriptionStatus,
    isCancelled: mocks.isCancelled,
    fetchStatus: mocks.fetchStatus,
    manageSubscription: mocks.manageSubscription,
    subscribe: mocks.subscribe,
    showSubscriptionDialog: mocks.showSubscriptionDialog
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get balance() {
      return mocks.balance.value
    },
    fetchBalance: mocks.fetchBalance
  })
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    purchaseCredits: mocks.purchaseCredits
  })
}))

describe('useLegacyBilling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.isActiveSubscription.value = false
    mocks.subscriptionTier.value = null
    mocks.subscriptionDuration.value = null
    mocks.subscriptionStatus.value = null
    mocks.isCancelled.value = false
    mocks.balance.value = null
    mocks.fetchStatus.mockResolvedValue(undefined)
    mocks.manageSubscription.mockResolvedValue(undefined)
    mocks.subscribe.mockResolvedValue(undefined)
    mocks.fetchBalance.mockResolvedValue(undefined)
    mocks.purchaseCredits.mockResolvedValue(undefined)
  })

  it('maps active subscription and explicit balance fields', () => {
    mocks.isActiveSubscription.value = true
    mocks.subscriptionTier.value = 'PRO'
    mocks.subscriptionDuration.value = 'MONTHLY'
    mocks.subscriptionStatus.value = {
      renewal_date: '2026-01-01T00:00:00Z',
      end_date: '2026-02-01T00:00:00Z'
    }
    mocks.balance.value = {
      amount_micros: 500,
      currency: 'eur',
      effective_balance_micros: 400,
      prepaid_balance_micros: 300,
      cloud_credit_balance_micros: 200
    }

    const billing = useLegacyBilling()

    expect(billing.subscription.value).toEqual({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      renewalDate: '2026-01-01T00:00:00Z',
      endDate: '2026-02-01T00:00:00Z',
      isCancelled: false,
      hasFunds: true
    })
    expect(billing.balance.value).toEqual({
      amountMicros: 500,
      currency: 'eur',
      effectiveBalanceMicros: 400,
      prepaidBalanceMicros: 300,
      cloudCreditBalanceMicros: 200
    })
    expect(billing.subscriptionStatus.value).toBe('active')
  })

  it('uses legacy balance defaults when optional fields are absent', () => {
    mocks.subscriptionTier.value = 'FREE'
    mocks.balance.value = {}

    const billing = useLegacyBilling()

    expect(billing.balance.value).toEqual({
      amountMicros: 0,
      currency: 'usd',
      effectiveBalanceMicros: 0,
      prepaidBalanceMicros: 0,
      cloudCreditBalanceMicros: 0
    })
    expect(billing.subscription.value?.hasFunds).toBe(false)
  })

  it('uses amount as effective balance when only amount is present', () => {
    mocks.balance.value = { amount_micros: 250 }

    const billing = useLegacyBilling()

    expect(billing.balance.value?.effectiveBalanceMicros).toBe(250)
  })

  it('reports canceled status before active status', () => {
    mocks.isActiveSubscription.value = true
    mocks.isCancelled.value = true

    const billing = useLegacyBilling()

    expect(billing.subscriptionStatus.value).toBe('canceled')
  })

  it('initializes once and re-fetches zero free-tier balance', async () => {
    mocks.subscriptionTier.value = 'FREE'
    mocks.balance.value = { amount_micros: 0 }
    const billing = useLegacyBilling()

    await billing.initialize()
    await billing.initialize()

    expect(billing.isInitialized.value).toBe(true)
    expect(mocks.fetchStatus).toHaveBeenCalledTimes(1)
    expect(mocks.fetchBalance).toHaveBeenCalledTimes(2)
  })

  it('stores initialization error messages from Error failures', async () => {
    mocks.fetchStatus.mockRejectedValue(new Error('status failed'))
    const billing = useLegacyBilling()

    await expect(billing.initialize()).rejects.toThrow('status failed')

    expect(billing.error.value).toBe('status failed')
    expect(billing.isLoading.value).toBe(false)
  })

  it('stores fallback initialization error messages for non-Error failures', async () => {
    mocks.fetchStatus.mockRejectedValue('status failed')
    const billing = useLegacyBilling()

    await expect(billing.initialize()).rejects.toBe('status failed')

    expect(billing.error.value).toBe('Failed to initialize billing')
  })

  it('stores subscription fetch fallback errors', async () => {
    mocks.fetchStatus.mockRejectedValue('status failed')
    const billing = useLegacyBilling()

    await expect(billing.fetchStatus()).rejects.toBe('status failed')

    expect(billing.error.value).toBe('Failed to fetch subscription')
    expect(billing.isLoading.value).toBe(false)
  })

  it('stores balance fetch errors', async () => {
    mocks.fetchBalance.mockRejectedValue(new Error('balance failed'))
    const billing = useLegacyBilling()

    await expect(billing.fetchBalance()).rejects.toThrow('balance failed')

    expect(billing.error.value).toBe('balance failed')
    expect(billing.isLoading.value).toBe(false)
  })

  it('stores balance fetch fallback errors', async () => {
    mocks.fetchBalance.mockRejectedValue('balance failed')
    const billing = useLegacyBilling()

    await expect(billing.fetchBalance()).rejects.toBe('balance failed')

    expect(billing.error.value).toBe('Failed to fetch balance')
  })

  it('delegates legacy billing actions', async () => {
    const billing = useLegacyBilling()

    await expect(billing.subscribe('pro-monthly')).resolves.toBeUndefined()
    await expect(billing.previewSubscribe('pro-monthly')).resolves.toBeNull()
    await billing.manageSubscription()
    await billing.cancelSubscription()
    await billing.resubscribe()
    await billing.topup(750)
    await expect(billing.fetchPlans()).resolves.toBeUndefined()
    billing.showSubscriptionDialog()

    expect(mocks.subscribe).toHaveBeenCalledTimes(2)
    expect(mocks.manageSubscription).toHaveBeenCalledTimes(2)
    expect(mocks.purchaseCredits).toHaveBeenCalledWith(7.5)
    expect(mocks.showSubscriptionDialog).toHaveBeenCalledTimes(1)
  })

  it('shows the subscription dialog when active subscription is required', async () => {
    const billing = useLegacyBilling()

    await billing.requireActiveSubscription()

    expect(mocks.showSubscriptionDialog).toHaveBeenCalledTimes(1)
  })

  it('does not show the subscription dialog for active subscribers', async () => {
    mocks.isActiveSubscription.value = true
    const billing = useLegacyBilling()

    await billing.requireActiveSubscription()

    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()
  })
})

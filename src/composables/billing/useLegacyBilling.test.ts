import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useLegacyBilling } from '@/composables/billing/useLegacyBilling'
import type {
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

const mockWorkspaceApi = vi.hoisted(() => ({
  subscribe: vi.fn(),
  previewSubscribe: vi.fn()
}))

const mockBillingPlans = vi.hoisted(() => ({
  plans: { value: [] as Plan[] },
  currentPlanSlug: { value: null as string | null },
  fetchPlans: vi.fn()
}))

const mockSubscription = vi.hoisted(() => ({
  isActiveSubscription: { value: false },
  subscriptionTier: { value: null as string | null },
  subscriptionDuration: { value: null as string | null },
  subscriptionStatus: { value: null as unknown },
  isCancelled: { value: false },
  fetchStatus: vi.fn(),
  manageSubscription: vi.fn(),
  subscribe: vi.fn(),
  showSubscriptionDialog: vi.fn()
}))

const mockAuthStore = vi.hoisted(() => ({
  balance: { amount_micros: 0, currency: 'usd' },
  fetchBalance: vi.fn()
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: mockWorkspaceApi
}))

vi.mock('@/platform/cloud/subscription/composables/useBillingPlans', () => ({
  useBillingPlans: () => mockBillingPlans
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => mockSubscription
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({ purchaseCredits: vi.fn() })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthStore
}))

let scope: ReturnType<typeof effectScope> | undefined

function setupBilling() {
  scope?.stop()
  scope = effectScope()
  const billing = scope.run(() => useLegacyBilling())
  if (!billing) throw new Error('Failed to create legacy billing composable')
  return billing
}

function makeStandardYearly(): Plan {
  return {
    slug: 'standard-yearly',
    tier: 'STANDARD',
    duration: 'ANNUAL',
    price_cents: 1600,
    credits_cents: 4200,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1600,
      total_credits_cents: 4200
    }
  }
}

const previewResponse: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-01-01T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 1600,
  cost_next_period_cents: 1600,
  credits_today_cents: 4200,
  credits_next_period_cents: 4200,
  new_plan: {
    slug: 'standard-yearly',
    tier: 'STANDARD',
    duration: 'ANNUAL',
    price_cents: 1600,
    credits_cents: 4200,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 1600,
      total_credits_cents: 4200
    }
  }
}

const subscribeResponse: SubscribeResponse = {
  billing_op_id: 'op-1',
  status: 'subscribed'
}

describe('useLegacyBilling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBillingPlans.plans.value = []
    mockBillingPlans.currentPlanSlug.value = null
    mockBillingPlans.fetchPlans.mockResolvedValue(undefined)
    mockSubscription.fetchStatus.mockResolvedValue(undefined)
    mockAuthStore.fetchBalance.mockResolvedValue(undefined)
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
  })

  describe('previewSubscribe', () => {
    it('delegates to workspaceApi and returns the real preview response', async () => {
      mockWorkspaceApi.previewSubscribe.mockResolvedValue(previewResponse)

      const billing = setupBilling()
      const result = await billing.previewSubscribe('standard-yearly')

      expect(mockWorkspaceApi.previewSubscribe).toHaveBeenCalledWith(
        'standard-yearly'
      )
      expect(result).toStrictEqual(previewResponse)
    })
  })

  describe('subscribe', () => {
    it('routes through workspaceApi.subscribe and refreshes status and balance', async () => {
      mockWorkspaceApi.subscribe.mockResolvedValue(subscribeResponse)

      const billing = setupBilling()
      const result = await billing.subscribe(
        'standard-yearly',
        'https://platform/success',
        'https://platform/failed'
      )

      expect(mockWorkspaceApi.subscribe).toHaveBeenCalledWith(
        'standard-yearly',
        'https://platform/success',
        'https://platform/failed'
      )
      expect(mockSubscription.fetchStatus).toHaveBeenCalled()
      expect(mockAuthStore.fetchBalance).toHaveBeenCalled()
      expect(result).toStrictEqual(subscribeResponse)
    })

    it('does not use the legacy Stripe-redirect subscribe path', async () => {
      mockWorkspaceApi.subscribe.mockResolvedValue(subscribeResponse)

      const billing = setupBilling()
      await billing.subscribe('standard-yearly')

      expect(mockSubscription.subscribe).not.toHaveBeenCalled()
    })
  })

  describe('plans', () => {
    it('exposes the shared /billing/plans catalog for single-seat checkout', () => {
      mockBillingPlans.plans.value = [makeStandardYearly()]
      mockBillingPlans.currentPlanSlug.value = 'standard-yearly'

      const billing = setupBilling()

      expect(billing.plans.value).toEqual([makeStandardYearly()])
      expect(billing.currentPlanSlug.value).toBe('standard-yearly')
    })

    it('fetchPlans delegates to the shared plans source', async () => {
      const billing = setupBilling()
      await billing.fetchPlans()

      expect(mockBillingPlans.fetchPlans).toHaveBeenCalledTimes(1)
    })
  })
})

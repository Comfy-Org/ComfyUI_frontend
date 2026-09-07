import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'

const {
  mockIsCloud,
  mockSubscribe,
  mockTrackBeginCheckout,
  mockTrackBillingEvent,
  mockUserId
} = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockSubscribe: vi.fn(),
  mockTrackBeginCheckout: vi.fn(),
  mockTrackBillingEvent: vi.fn(),
  mockUserId: { value: 'user-1' }
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))
vi.mock('@/config/comfyApi', () => ({
  getComfyPlatformBaseUrl: () => 'https://app.test'
}))
vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: { subscribe: mockSubscribe },
  WorkspaceApiError: class WorkspaceApiError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string
    ) {
      super(message)
      this.name = 'WorkspaceApiError'
    }
  }
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBeginCheckout: mockTrackBeginCheckout,
    trackBillingEvent: mockTrackBillingEvent
  })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => reactive({ userId: computed(() => mockUserId.value) }),
  AuthStoreError: class AuthStoreError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthStoreError'
    }
  }
}))

import { performTeamSubscriptionCheckout } from './teamSubscriptionCheckoutUtil'

describe('performTeamSubscriptionCheckout', () => {
  let assignedHref: string | undefined

  beforeEach(() => {
    mockIsCloud.value = true
    assignedHref = undefined
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
        origin: 'https://app.test',
        pathname: '/payment/success',
        set href(value: string) {
          assignedHref = value
        }
      }
    })
  })

  it('subscribes at the stop with the yearly slug and redirects to the Stripe payment page', async () => {
    mockSubscribe.mockResolvedValue({
      status: 'needs_payment_method',
      payment_method_url: 'https://stripe.test/pay',
      billing_op_id: 'op_1'
    })

    await performTeamSubscriptionCheckout('team_700', 'yearly', {
      paymentIntentSource: 'deep_link'
    })

    expect(mockSubscribe).toHaveBeenCalledWith('team_per_credit_annual', {
      returnUrl: 'https://app.test/payment/success',
      cancelUrl: 'https://app.test/payment/failed',
      teamCreditStopId: 'team_700'
    })
    expect(assignedHref).toBe('https://stripe.test/pay')
    expect(mockTrackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-1',
      tier: 'team',
      cycle: 'yearly',
      checkout_type: 'new',
      billing_op_id: 'op_1',
      payment_intent_source: 'deep_link'
    })
  })

  it('uses the monthly slug and lands in the app when no Stripe step is needed', async () => {
    mockSubscribe.mockResolvedValue({
      status: 'subscribed',
      billing_op_id: 'op_2'
    })

    await performTeamSubscriptionCheckout('team_1400', 'monthly')

    expect(mockSubscribe).toHaveBeenCalledWith('team_per_credit_monthly', {
      returnUrl: expect.any(String),
      cancelUrl: expect.any(String),
      teamCreditStopId: 'team_1400'
    })
    expect(assignedHref).toBe('/')
  })

  it('throws when payment is needed but no payment URL is returned', async () => {
    mockSubscribe.mockResolvedValue({
      status: 'needs_payment_method',
      billing_op_id: 'op_3'
    })

    await expect(
      performTeamSubscriptionCheckout('team_700', 'yearly')
    ).rejects.toThrow(/payment URL/)

    expect(assignedHref).toBeUndefined()
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: 'team',
      cycle: 'yearly',
      checkout_type: 'new',
      payment_intent_source: undefined,
      failure_category: 'unknown'
    })
  })

  it('does not track begin_checkout when subscribe fails, but does track the failure', async () => {
    mockSubscribe.mockRejectedValueOnce(new Error('subscribe failed'))

    await expect(
      performTeamSubscriptionCheckout('team_700', 'yearly', {
        paymentIntentSource: 'deep_link'
      })
    ).rejects.toThrow('subscribe failed')

    expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: 'team',
      cycle: 'yearly',
      checkout_type: 'new',
      payment_intent_source: 'deep_link',
      failure_category: 'unknown'
    })
  })

  it('does nothing off cloud', async () => {
    mockIsCloud.value = false

    await performTeamSubscriptionCheckout('team_700', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(assignedHref).toBeUndefined()
  })
})

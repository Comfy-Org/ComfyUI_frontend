import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'

const { mockIsCloud, mockSubscribe, mockTrackBeginCheckout, mockUserId } =
  vi.hoisted(() => ({
    mockIsCloud: { value: true },
    mockSubscribe: vi.fn(),
    mockTrackBeginCheckout: vi.fn(),
    mockUserId: { value: 'user-1' as string | null }
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
  workspaceApi: { subscribe: mockSubscribe }
}))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackBeginCheckout: mockTrackBeginCheckout })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => reactive({ userId: computed(() => mockUserId.value) })
}))

import { performTeamSubscriptionCheckout } from './teamSubscriptionCheckoutUtil'

describe('performTeamSubscriptionCheckout', () => {
  let assignedHref: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    assignedHref = undefined
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {
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
  })

  it('does not track begin_checkout when subscribe fails', async () => {
    mockSubscribe.mockRejectedValueOnce(new Error('subscribe failed'))

    await expect(
      performTeamSubscriptionCheckout('team_700', 'yearly')
    ).rejects.toThrow('subscribe failed')

    expect(mockTrackBeginCheckout).not.toHaveBeenCalled()
  })

  it('does nothing off cloud', async () => {
    mockIsCloud.value = false

    await performTeamSubscriptionCheckout('team_700', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(assignedHref).toBeUndefined()
  })
})

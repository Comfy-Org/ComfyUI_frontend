import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsCloud, mockSubscribe } = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockSubscribe: vi.fn()
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

    await performTeamSubscriptionCheckout('team_700', 'yearly')

    expect(mockSubscribe).toHaveBeenCalledWith(
      'team_per_credit_annual',
      'https://app.test/payment/success',
      'https://app.test/payment/failed',
      'team_700'
    )
    expect(assignedHref).toBe('https://stripe.test/pay')
  })

  it('uses the monthly slug and lands in the app when no Stripe step is needed', async () => {
    mockSubscribe.mockResolvedValue({
      status: 'subscribed',
      billing_op_id: 'op_2'
    })

    await performTeamSubscriptionCheckout('team_1400', 'monthly')

    expect(mockSubscribe).toHaveBeenCalledWith(
      'team_per_credit_monthly',
      expect.any(String),
      expect.any(String),
      'team_1400'
    )
    expect(assignedHref).toBe('/')
  })

  it('does nothing off cloud', async () => {
    mockIsCloud.value = false

    await performTeamSubscriptionCheckout('team_700', 'yearly')

    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(assignedHref).toBeUndefined()
  })
})

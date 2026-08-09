import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePaymentReturnUrlLoader } from './usePaymentReturnUrlLoader'

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn().mockResolvedValue(undefined),
  fetchStatus: vi.fn().mockResolvedValue(undefined),
  pollPendingOperations: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.query }),
  useRouter: () => ({ replace: mocks.replace })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchStatus: mocks.fetchStatus })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    pollPendingOperations: mocks.pollPendingOperations
  })
}))

describe('usePaymentReturnUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mocks.query)) delete mocks.query[key]
  })

  it('strips Stripe return params and refreshes billing status', async () => {
    Object.assign(mocks.query, {
      payment_intent: 'pi_123',
      payment_intent_client_secret: 'pi_123_secret_abc',
      redirect_status: 'succeeded',
      workspace: 'ws-1'
    })

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(mocks.replace).toHaveBeenCalledWith({
      query: { workspace: 'ws-1' }
    })
    expect(mocks.fetchStatus).toHaveBeenCalledOnce()
    expect(mocks.pollPendingOperations).toHaveBeenCalledOnce()
  })

  it('does nothing on an ordinary page load', async () => {
    Object.assign(mocks.query, { workspace: 'ws-1' })

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.fetchStatus).not.toHaveBeenCalled()
    expect(mocks.pollPendingOperations).not.toHaveBeenCalled()
  })
})

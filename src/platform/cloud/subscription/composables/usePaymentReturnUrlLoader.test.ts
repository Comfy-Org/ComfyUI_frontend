import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stripPaymentReturnParams } from '@/platform/cloud/subscription/utils/paymentReturnUrl'

import { usePaymentReturnUrlLoader } from './usePaymentReturnUrlLoader'

const mocks = vi.hoisted(() => ({
  fetchStatus: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ fetchStatus: mocks.fetchStatus })
}))

describe('usePaymentReturnUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('refreshes billing after bootstrap strips Stripe return params', async () => {
    window.history.replaceState(
      {},
      '',
      '/?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_abc&redirect_status=succeeded&workspace=ws-1'
    )
    stripPaymentReturnParams()

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(window.location.search).toBe('?workspace=ws-1')
    expect(mocks.fetchStatus).toHaveBeenCalledOnce()
  })

  it('does nothing on an ordinary page load', async () => {
    window.history.replaceState({}, '', '/?workspace=ws-1')

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(mocks.fetchStatus).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { stripPaymentReturnParams } from '@/platform/cloud/subscription/utils/paymentReturnUrl'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { usePaymentReturnUrlLoader } from './usePaymentReturnUrlLoader'

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/useFeatureFlags'))
describe('usePaymentReturnUrlLoader', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('refreshes billing after bootstrap strips Stripe return params', async () => {
    const billing = mockBillingContext()
    vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = true
    window.history.replaceState(
      {},
      '',
      '/?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_abc&redirect_status=succeeded&workspace=ws-1'
    )
    stripPaymentReturnParams()

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(window.location.search).toBe('?workspace=ws-1')
    expect(billing.fetchStatus).toHaveBeenCalledOnce()
  })

  it('does nothing on an ordinary page load', async () => {
    const billing = mockBillingContext()
    window.history.replaceState({}, '', '/?workspace=ws-1')

    const { loadPaymentReturnFromUrl } = usePaymentReturnUrlLoader()
    await loadPaymentReturnFromUrl()

    expect(billing.fetchStatus).not.toHaveBeenCalled()
  })

  it('does not start embedded recovery while the flag is off', async () => {
    const billing = mockBillingContext()
    vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = false
    window.history.replaceState(
      {},
      '',
      '/?payment_intent=pi_123&redirect_status=succeeded'
    )
    stripPaymentReturnParams()

    await usePaymentReturnUrlLoader().loadPaymentReturnFromUrl()

    expect(billing.fetchStatus).not.toHaveBeenCalled()
  })
})

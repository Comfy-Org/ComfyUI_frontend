import { describe, expect, it, vi } from 'vitest'

import { stripPaymentReturnParams } from './paymentReturnUrl'

describe('stripPaymentReturnParams', () => {
  it('also drops the outcome billing-web appends on the way back', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('location', {
      href: 'https://cloud.comfy.org/?workspace=ws_1&billing_result=success&billing_ref=op_9#graph'
    })
    vi.stubGlobal('history', { state: { key: 1 }, replaceState })

    stripPaymentReturnParams()

    expect(replaceState).toHaveBeenCalledWith(
      { key: 1 },
      '',
      new URL('https://cloud.comfy.org/?workspace=ws_1#graph')
    )
  })

  it('drops the Stripe return params, client secret included', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('location', {
      href: 'https://cloud.comfy.org/?workspace=ws_1&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret&redirect_status=succeeded'
    })
    vi.stubGlobal('history', { state: null, replaceState })

    stripPaymentReturnParams()

    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      new URL('https://cloud.comfy.org/?workspace=ws_1')
    )
  })

  it('leaves a URL without return params untouched', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('location', {
      href: 'https://cloud.comfy.org/?workspace=ws_1'
    })
    vi.stubGlobal('history', { state: null, replaceState })

    stripPaymentReturnParams()

    expect(replaceState).not.toHaveBeenCalled()
  })
})

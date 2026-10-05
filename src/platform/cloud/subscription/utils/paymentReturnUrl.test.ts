import { describe, expect, it, vi } from 'vitest'

import {
  consumePaymentReturn,
  paymentReturnUrl,
  stripPaymentReturnParams
} from './paymentReturnUrl'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

describe('paymentReturnUrl', () => {
  it('returns to the page the checkout started on, without query or hash', () => {
    vi.stubGlobal('location', {
      origin: 'https://cloud.comfy.org',
      pathname: '/workspace/abc',
      search: '?pricing=team',
      hash: '#section'
    })
    expect(paymentReturnUrl()).toBe('https://cloud.comfy.org/workspace/abc')
  })

  it('accepts an HTTP origin', () => {
    vi.stubGlobal('location', {
      origin: 'http://localhost:5173',
      pathname: '/workspace/abc'
    })

    expect(paymentReturnUrl()).toBe('http://localhost:5173/workspace/abc')
  })

  it('falls back to the platform success page on a non-HTTP origin, which the backend would reject', () => {
    vi.stubGlobal('location', {
      origin: 'file://',
      pathname: '/index.html'
    })
    expect(paymentReturnUrl()).toBe(
      'https://platform.comfy.org/payment/success'
    )
  })
})

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

  it('does not read a billing-web return as a pending Stripe payment', () => {
    vi.stubGlobal('location', {
      href: 'https://cloud.comfy.org/?billing_result=success'
    })
    vi.stubGlobal('history', { state: null, replaceState: vi.fn() })

    expect(consumePaymentReturn()).toBe(false)
  })
})

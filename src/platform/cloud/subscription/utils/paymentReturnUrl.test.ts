import { describe, expect, it, vi } from 'vitest'

import { paymentReturnUrl } from './paymentReturnUrl'

vi.mock('@/config/comfyApi', () => ({
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

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import {
  getBillingWebUrl,
  normalizeHostedBillingDestination
} from './billingWeb'

describe('normalizeHostedBillingDestination', () => {
  it('routes to the hosted app only on the exact billing_web variant', () => {
    expect(normalizeHostedBillingDestination('billing_web')).toBe('billing_web')
  })

  it.for([
    'stripe',
    '',
    null,
    undefined,
    true,
    false,
    'true',
    'BILLING_WEB',
    'billing-web'
  ])('stays on the provider page for %s', (value) => {
    expect(normalizeHostedBillingDestination(value)).toBe('stripe')
  })
})

describe('getBillingWebUrl', () => {
  beforeEach(() => {
    remoteConfig.value = {}
  })

  it('accepts an HTTPS deployment URL from the env fallback', () => {
    vi.stubEnv('VITE_BILLING_WEB_URL', 'https://billing.comfy.org/app')

    expect(getBillingWebUrl()?.href).toBe('https://billing.comfy.org/app')
  })

  it('accepts an HTTP localhost URL during development', () => {
    vi.stubEnv('VITE_BILLING_WEB_URL', 'http://localhost:5174')

    expect(getBillingWebUrl()?.href).toBe('http://localhost:5174/')
  })

  it.for([
    'http://billing.example.com',
    'https://user:password@billing.example.com',
    'not a URL'
  ])('rejects an unsafe env fallback URL: %s', (url) => {
    vi.stubEnv('VITE_BILLING_WEB_URL', url)

    expect(getBillingWebUrl()).toBeNull()
  })

  it('prefers the server value over the env fallback', () => {
    remoteConfig.value = { billing_web_url: 'https://stagingbilling.comfy.org' }
    vi.stubEnv('VITE_BILLING_WEB_URL', 'http://localhost:5174')

    expect(getBillingWebUrl()?.href).toBe('https://stagingbilling.comfy.org/')
  })

  it('falls through to the env fallback when the server sends nothing', () => {
    remoteConfig.value = {}
    vi.stubEnv('VITE_BILLING_WEB_URL', 'http://localhost:5174')

    expect(getBillingWebUrl()?.href).toBe('http://localhost:5174/')
  })

  it('fails closed to null when the server value is invalid, ignoring the env fallback', () => {
    remoteConfig.value = { billing_web_url: 'http://billing.example.com' }
    vi.stubEnv('VITE_BILLING_WEB_URL', 'https://billing.comfy.org')

    expect(getBillingWebUrl()).toBeNull()
  })
})

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
  it('accepts an HTTPS deployment URL', () => {
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
  ])('rejects an unsafe deployment URL: %s', (url) => {
    vi.stubEnv('VITE_BILLING_WEB_URL', url)

    expect(getBillingWebUrl()).toBeNull()
  })
})

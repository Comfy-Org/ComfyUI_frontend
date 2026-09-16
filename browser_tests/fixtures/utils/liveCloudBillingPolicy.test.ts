import { describe, expect, it } from 'vitest'

import { isLiveCloudMutationAllowed } from '@e2e/fixtures/utils/liveCloudBillingPolicy'

describe('live Cloud mutation policy', () => {
  it.for([
    { method: 'GET', path: '/api/billing/status', allowed: true },
    { method: 'HEAD', path: '/api/billing/status', allowed: true },
    { method: 'OPTIONS', path: '/api/billing/status', allowed: true },
    { method: 'POST', path: '/customers', allowed: true },
    { method: 'POST', path: '/api/auth/token', allowed: true },
    { method: 'POST', path: '/api/auth/session', allowed: true },
    { method: 'POST', path: '/api/billing/subscribe', allowed: false },
    { method: 'POST', path: '/api/billing/payment-portal', allowed: false },
    { method: 'POST', path: '/customers/credit', allowed: false },
    { method: 'DELETE', path: '/customers', allowed: false },
    { method: 'PATCH', path: '/api/billing/payment-methods', allowed: false },
    { method: 'PUT', path: '/api/billing/subscription', allowed: false },
    { method: 'POST', path: '/internal/reset', allowed: false },
    { method: 'POST', path: '/api/future-mutation', allowed: false }
  ])('$method $path allowed=$allowed', ({ method, path, allowed }) => {
    expect(
      isLiveCloudMutationAllowed(
        new URL(path, 'https://testcloud.comfy.org'),
        method
      )
    ).toBe(allowed)
  })

  it.for([
    {
      url: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test',
      allowed: true
    },
    {
      url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
      allowed: true
    },
    { url: 'https://securetoken.googleapis.com/v1/token', allowed: true },
    {
      url: 'https://identitytoolkit.googleapis.com/v1/accounts:delete',
      allowed: false
    },
    { url: 'https://securetoken.googleapis.com/customers', allowed: false }
  ])('auth POST $url allowed=$allowed', ({ url, allowed }) => {
    expect(isLiveCloudMutationAllowed(new URL(url), 'POST')).toBe(allowed)
  })
})

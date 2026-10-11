import { describe, expect, it } from 'vitest'

import { liveCloudBillingConfigSchema } from '@e2e/fixtures/utils/liveCloudBillingConfig'

import {
  getBlockedRequestViolation,
  getLiveCloudDestinationViolation,
  isLiveCloudMutationAllowed,
  isReportedViolation
} from '@e2e/fixtures/utils/liveCloudBillingPolicy'

const config = {
  PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
  PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org',
  customerOrigin: 'https://testapi.comfy.org'
}

describe('live Cloud mutation policy', () => {
  it.for([
    { method: 'GET', path: '/api/billing/status', allowed: true },
    { method: 'HEAD', path: '/api/billing/status', allowed: true },
    { method: 'OPTIONS', path: '/api/billing/status', allowed: true },
    { method: 'POST', path: '/customers', allowed: false },
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
        method,
        config
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
    expect(isLiveCloudMutationAllowed(new URL(url), 'POST', config)).toBe(
      allowed
    )
  })
})

describe('live Cloud mutation origins', () => {
  it.for([
    'https://dreamboothy-dev.firebaseapp.com/customers',
    'https://dreamboothy-dev.firebaseapp.com/api/auth/token',
    'https://dreamboothy-dev.firebaseapp.com/api/auth/session',
    'http://localhost:5173/customers',
    'http://localhost:5173/api/auth/token',
    'http://localhost:5173/api/auth/session',
    'https://testapi.comfy.org/api/auth/token',
    'https://testapi.comfy.org/api/auth/session',
    'https://stagingapi.comfy.org/customers',
    'https://stagingcloud.comfy.org/api/auth/token'
  ])('rejects POST %s for the selected test sandbox', (url) => {
    expect(isLiveCloudMutationAllowed(new URL(url), 'POST', config)).toBe(false)
  })

  it.for([
    {
      cloud: 'https://testcloud.comfy.org',
      customer: 'https://testapi.comfy.org'
    },
    {
      cloud: 'https://stagingcloud.comfy.org',
      customer: 'https://stagingapi.comfy.org'
    },
    {
      cloud: 'https://pr-123.testenvs.comfy.org',
      customer: 'https://pr-123-registry.testenvs.comfy.org'
    }
  ])(
    'allows customer provisioning only at $customer for $cloud',
    ({ cloud, customer }) => {
      const selected = liveCloudBillingConfigSchema.parse({
        ...config,
        PLAYWRIGHT_SETUP_API_URL: cloud,
        CLOUD_ACCOUNT_EMAIL: 'unused@example.com',
        CLOUD_ACCOUNT_PASSWORD: 'unused'
      })
      expect(
        isLiveCloudMutationAllowed(
          new URL('/customers', customer),
          'POST',
          selected
        )
      ).toBe(true)
      expect(
        isLiveCloudMutationAllowed(
          new URL('/customers', cloud),
          'POST',
          selected
        )
      ).toBe(false)
    }
  )
})

describe('live Cloud destinations', () => {
  it.for([
    {
      url: 'https://testcloud.comfy.org/api/billing/status',
      navigation: true,
      violation: undefined
    },
    {
      url: 'https://cloud.comfy.org/api/billing/status?secret=redacted',
      navigation: false,
      violation: 'API https://cloud.comfy.org/api/billing/status'
    },
    {
      url: 'https://api.comfy.org/customers',
      navigation: true,
      violation: 'API https://api.comfy.org/customers'
    },
    {
      url: 'https://external.invalid/checkout',
      navigation: true,
      violation: 'Navigation https://external.invalid/checkout'
    },
    {
      url: 'https://external.invalid/script.js',
      navigation: false,
      violation: undefined
    },
    {
      url: 'https://cloud.comfy.org/apiary',
      navigation: false,
      violation: undefined
    }
  ])('$url navigation=$navigation', ({ url, navigation, violation }) => {
    expect(
      getLiveCloudDestinationViolation(
        new URL(url),
        new Set(['https://testcloud.comfy.org']),
        navigation
      )
    ).toBe(violation)
  })
})

describe('blocked request violations', () => {
  it.for([
    {
      method: 'GET',
      url: 'https://third.party/pixel.gif',
      violation: 'GET https://third.party/pixel.gif'
    },
    {
      method: 'POST',
      url: 'https://third.party/collect',
      violation: 'Mutation POST https://third.party/collect'
    },
    {
      method: 'DELETE',
      url: 'https://third.party/session?token=redacted',
      violation: 'Mutation DELETE https://third.party/session'
    }
  ])('$method $url', ({ method, url, violation }) => {
    expect(getBlockedRequestViolation(new URL(url), method)).toBe(violation)
  })

  it.for([
    { method: 'GET', reported: false },
    { method: 'POST', reported: true }
  ])(
    '$method survives the live report filter: $reported',
    ({ method, reported }) => {
      expect(
        isReportedViolation(
          getBlockedRequestViolation(
            new URL('https://third.party/collect'),
            method
          )
        )
      ).toBe(reported)
    }
  )
})

import { describe, expect, it } from 'vitest'

import {
  getLiveCloudEnvironment,
  liveCloudBillingConfigSchema
} from '@e2e/fixtures/utils/liveCloudBillingConfig'

import {
  getBlockedRequestViolation,
  getLiveCloudDestinationViolation,
  isLiveCloudMutationAllowed,
  isLiveCloudAuxiliaryPost,
  isReportedViolation
} from '@e2e/fixtures/utils/liveCloudBillingPolicy'

const config = {
  PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
  PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org',
  customerOrigin: 'https://testapi.comfy.org',
  environment: getLiveCloudEnvironment('https://testcloud.comfy.org'),
  allowCheckout: false,
  allowPayments: false,
  allowAccountCreation: false
}

describe('live Cloud mutation policy', () => {
  it.for([
    { method: 'GET', path: '/api/billing/status', allowed: true },
    { method: 'HEAD', path: '/api/billing/status', allowed: true },
    { method: 'OPTIONS', path: '/api/billing/status', allowed: true },
    { method: 'POST', path: '/customers', allowed: false },
    { method: 'POST', path: '/api/auth/token', allowed: true },
    { method: 'POST', path: '/api/auth/session', allowed: true },
    {
      method: 'POST',
      path: '/api/settings/Comfy.InstalledVersion',
      allowed: true
    },
    { method: 'POST', path: '/api/settings/other', allowed: false },
    {
      method: 'POST',
      path: '/api/settings/Comfy.OnboardingCoachmarks.Seen',
      allowed: true
    },
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

  it.for([
    { data: { onboarding_survey: { intent: 'exploring' } }, allowed: true },
    { data: undefined, allowed: false },
    { data: {}, allowed: false },
    { data: { onboarding_survey: null }, allowed: false },
    { data: { unrelated: true }, allowed: false },
    {
      data: { onboarding_survey: { intent: 'exploring' }, unrelated: true },
      allowed: false
    }
  ])('survey settings $data allowed=$allowed', ({ data, allowed }) => {
    expect(
      isLiveCloudMutationAllowed(
        new URL('/api/settings', config.PLAYWRIGHT_SETUP_API_URL),
        'POST',
        config,
        data
      )
    ).toBe(allowed)
    expect(
      isLiveCloudMutationAllowed(
        new URL('/api/settings', 'https://stagingcloud.comfy.org'),
        'POST',
        config,
        data
      )
    ).toBe(false)
  })
})

describe('live Cloud checkout mutation policy', () => {
  it('blocks checkout initialization when checkout is disabled', () => {
    expect(
      isLiveCloudMutationAllowed(
        new URL('https://api.stripe.com/v1/payment_pages/cs_test_example/init'),
        'POST',
        config
      )
    ).toBe(false)
  })

  it.for([
    {
      url: 'https://testcloud.comfy.org/api/billing/preview-subscribe',
      method: 'POST',
      allowed: true
    },
    {
      url: 'https://testcloud.comfy.org/api/billing/subscribe',
      method: 'POST',
      allowed: true
    },
    {
      url: 'https://stagingcloud.comfy.org/api/billing/subscribe',
      method: 'POST',
      allowed: false
    },
    {
      url: 'https://testcloud.comfy.org/api/billing/payment-portal',
      method: 'POST',
      allowed: false
    },
    {
      url: 'https://testcloud.comfy.org/api/billing/subscribe',
      method: 'DELETE',
      allowed: false
    },
    {
      url: 'https://api.stripe.com/v1/payment_pages/cs_test_example/init',
      method: 'POST',
      allowed: true
    },
    {
      url: 'https://api.stripe.com/v1/payment_pages/cs_live_example/init',
      method: 'POST',
      allowed: false
    },
    {
      url: 'https://api.stripe.com/v1/payment_pages/cs_test_example/confirm',
      method: 'POST',
      allowed: false
    },
    {
      url: 'https://api.stripe.com/v1/payment_methods',
      method: 'POST',
      allowed: false
    },
    {
      url: 'https://api.stripe.com/v1/payment_pages/cs_test_example/init',
      method: 'PUT',
      allowed: false
    },
    {
      url: 'https://checkout.stripe.com/v1/payment_pages/cs_test_example/init',
      method: 'POST',
      allowed: false
    },
    { url: 'https://r.stripe.com/b', method: 'POST', allowed: true },
    { url: 'https://r.stripe.com/0', method: 'POST', allowed: true },
    { url: 'https://r.stripe.com/other', method: 'POST', allowed: false },
    { url: 'https://m.stripe.com/6', method: 'POST', allowed: true }
  ])(
    '$method $url allowed=$allowed with checkout enabled',
    ({ url, method, allowed }) => {
      expect(
        isLiveCloudMutationAllowed(new URL(url), method, {
          ...config,
          allowCheckout: true
        })
      ).toBe(allowed)
    }
  )
})

describe('production checkout', () => {
  it.for([
    { mode: 'live', action: 'init', allowed: true },
    { mode: 'test', action: 'init', allowed: false },
    { mode: 'live', action: 'confirm', allowed: false }
  ])('$mode checkout $action allowed=$allowed', ({ mode, action, allowed }) => {
    expect(
      isLiveCloudMutationAllowed(
        new URL(
          `https://api.stripe.com/v1/payment_pages/cs_${mode}_example/${action}`
        ),
        'POST',
        {
          ...config,
          PLAYWRIGHT_SETUP_API_URL: 'https://cloud.comfy.org',
          environment: getLiveCloudEnvironment('https://cloud.comfy.org'),
          allowCheckout: true
        }
      )
    ).toBe(allowed)
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
      cloud: 'https://cloud.comfy.org',
      customer: 'https://api.comfy.org'
    },
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

describe('Disposable payment permissions', () => {
  it.for([
    {
      url: 'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
      permission: 'allowAccountCreation',
      opposite: 'allowPayments'
    },
    {
      url: 'https://api.stripe.com/v1/payment_methods',
      permission: 'allowPayments',
      opposite: 'allowAccountCreation'
    },
    {
      url: 'https://checkout.comfy.org/ajax/metrics_batch',
      permission: 'allowPayments',
      opposite: 'allowAccountCreation'
    },
    {
      url: 'https://testcloud.comfy.org/api/billing/payment-portal',
      permission: 'allowPayments',
      opposite: 'allowAccountCreation'
    },
    {
      url: 'https://api.stripe.com/v1/payment_pages/cs_test_example/confirm',
      permission: 'allowPayments',
      opposite: 'allowAccountCreation'
    }
  ])('requires $permission for $url', ({ url, permission, opposite }) => {
    const enabled = { ...config, [permission]: true }
    expect(isLiveCloudMutationAllowed(new URL(url), 'POST', config)).toBe(false)
    expect(isLiveCloudMutationAllowed(new URL(url), 'POST', enabled)).toBe(true)
    expect(
      isLiveCloudMutationAllowed(new URL(url), 'POST', {
        ...config,
        [opposite]: true
      })
    ).toBe(false)
    expect(
      isLiveCloudMutationAllowed(new URL(url), 'POST', {
        ...enabled,
        PLAYWRIGHT_SETUP_API_URL: 'https://cloud.comfy.org',
        environment: getLiveCloudEnvironment('https://cloud.comfy.org')
      })
    ).toBe(false)
    expect(isLiveCloudMutationAllowed(new URL(url), 'PUT', enabled)).toBe(false)
    const wrongOrigin = new URL(url)
    wrongOrigin.hostname = 'untrusted.example.com'
    expect(isLiveCloudMutationAllowed(wrongOrigin, 'POST', enabled)).toBe(false)
    expect(
      isLiveCloudMutationAllowed(new URL(`${url}/unexpected`), 'POST', enabled)
    ).toBe(false)
  })
})

describe('Live Cloud auxiliary services', () => {
  it.for([
    { url: 'https://t.comfy.org/flags/?v=2', method: 'POST', allowed: true },
    {
      url: 'https://www.google-analytics.com/g/collect',
      method: 'POST',
      allowed: true
    },
    { url: 'https://mp.comfy.org/track/', method: 'POST', allowed: true },
    { url: 'https://cdp.customer.io/v1/i', method: 'POST', allowed: true },
    {
      url: 'https://unknown.example.com/collect',
      method: 'POST',
      allowed: false
    },
    { url: 'https://t.comfy.org/admin', method: 'POST', allowed: false },
    { url: 'https://t.comfy.org/flags/', method: 'DELETE', allowed: false },
    { url: 'http://t.comfy.org/flags/', method: 'POST', allowed: false }
  ])('$method $url allowed=$allowed', ({ url, method, allowed }) => {
    expect(isLiveCloudAuxiliaryPost(new URL(url), method)).toBe(allowed)
  })
})

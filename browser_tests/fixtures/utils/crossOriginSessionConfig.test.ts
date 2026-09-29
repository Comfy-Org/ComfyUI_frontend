import { describe, expect, it } from 'vitest'

import {
  allowedOrigins,
  localUpstreamFor,
  missingSessionEnv,
  parseCrossOriginSessionEnv,
  refusedComfyEgress
} from '@e2e/fixtures/utils/crossOriginSessionConfig'

describe('parseCrossOriginSessionEnv', () => {
  it('accepts an empty environment so the suite can be listed', () => {
    expect(parseCrossOriginSessionEnv({})).toEqual({})
  })

  it('treats empty strings as unset', () => {
    expect(parseCrossOriginSessionEnv({ SESSION_E2E_CLOUD_URL: '' })).toEqual(
      {}
    )
  })

  it.for([
    [
      'a production Cloud origin',
      'SESSION_E2E_CLOUD_URL',
      'https://cloud.comfy.org'
    ],
    [
      'production billing-web',
      'SESSION_E2E_BILLING_URL',
      'https://billing.comfy.org'
    ],
    [
      'a host outside comfy.org',
      'SESSION_E2E_WEBSITE_URL',
      'https://example.com'
    ],
    ['plain http', 'SESSION_E2E_WEBSITE_URL', 'http://www.comfy.org'],
    [
      'an origin with a path',
      'SESSION_E2E_CLOUD_URL',
      'https://testcloud.comfy.org/cloud'
    ],
    [
      'a remote upstream',
      'SESSION_E2E_WEBSITE_UPSTREAM',
      'https://www.comfy.org'
    ]
  ])('rejects %s', ([, key, value]) => {
    expect(() => parseCrossOriginSessionEnv({ [key]: value })).toThrow(key)
  })
})

describe('session env helpers', () => {
  const env = parseCrossOriginSessionEnv({
    SESSION_E2E_CLOUD_URL: 'https://testcloud.comfy.org',
    SESSION_E2E_CLOUD_UPSTREAM: 'http://localhost:4173',
    SESSION_E2E_WEBSITE_URL: 'https://www.comfy.org/',
    SESSION_E2E_WEBSITE_UPSTREAM: 'http://localhost:4321/',
    SESSION_E2E_BILLING_URL: 'https://testbilling.comfy.org',
    SESSION_E2E_EXTRA_ORIGINS: 'https://challenges.cloudflare.com'
  })

  it.for([
    ['https://testcloud.comfy.org/api/features', undefined],
    ['https://testcloud.comfy.org/api/auth/session', undefined],
    ['https://testcloud.comfy.org/ws', undefined],
    ['https://testcloud.comfy.org/internal/x', undefined],
    ['https://testcloud.comfy.org/cloud/login', 'http://localhost:4173'],
    ['https://testcloud.comfy.org/assets/x.js', 'http://localhost:4173'],
    ['https://testcloud.comfy.org/oauth/consent', 'http://localhost:4173'],
    ['https://testcloud.comfy.org/oauth/token', undefined],
    ['https://testcloud.comfy.org/apix', 'http://localhost:4173'],
    ['https://www.comfy.org/api/x', 'http://localhost:4321'],
    ['https://testbilling.comfy.org/', undefined],
    ['https://elsewhere.comfy.org/', undefined]
  ] as const)('serves %s from %s', ([url, upstream]) => {
    expect(localUpstreamFor(new URL(url), env)).toBe(upstream)
  })

  it('serves billing-web whole when it has an upstream', () => {
    const withBilling = parseCrossOriginSessionEnv({
      SESSION_E2E_BILLING_URL: 'https://testbilling.comfy.org',
      SESSION_E2E_BILLING_UPSTREAM: 'http://localhost:5174'
    })
    expect(
      localUpstreamFor(
        new URL('https://testbilling.comfy.org/api/x'),
        withBilling
      )
    ).toBe('http://localhost:5174')
  })

  it('allows the configured sites, Firebase Auth and the extra origins', () => {
    expect([...allowedOrigins(env)].sort()).toEqual([
      'https://challenges.cloudflare.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://testbilling.comfy.org',
      'https://testcloud.comfy.org',
      'https://www.comfy.org'
    ])
  })

  it.for([
    ['https://cloud.comfy.org/api/features', 'Production'],
    ['https://api.comfy.org/nodes', 'Production'],
    ['https://docs.comfy.org/', 'Unlisted comfy.org'],
    ['https://comfy.org/', 'Unlisted comfy.org'],
    ['https://testapi.comfy.org/', 'Unlisted comfy.org'],
    ['https://testcloud.comfy.org/api/auth/session', undefined],
    ['https://www.comfy.org/pricing', undefined],
    ['https://example.com/', undefined]
  ] as const)('refuses %s as %s', ([url, reason]) => {
    expect(refusedComfyEgress(new URL(url), allowedOrigins(env))).toBe(reason)
  })

  it('refuses production even when it is allowed', () => {
    expect(
      refusedComfyEgress(
        new URL('https://cloud.comfy.org/'),
        new Set(['https://cloud.comfy.org'])
      )
    ).toBe('Production')
  })

  it('names the variables a test still needs', () => {
    expect(
      missingSessionEnv(env, ['SESSION_E2E_CLOUD_URL', 'SESSION_E2E_EMAIL'])
    ).toEqual(['SESSION_E2E_EMAIL'])
  })
})

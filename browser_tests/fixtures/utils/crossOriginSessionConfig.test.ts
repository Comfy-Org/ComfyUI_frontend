import { describe, expect, it } from 'vitest'

import {
  allowedOrigins,
  mappedOrigins,
  missingSessionEnv,
  parseCrossOriginSessionEnv
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
    SESSION_E2E_WEBSITE_URL: 'https://www.comfy.org/',
    SESSION_E2E_WEBSITE_UPSTREAM: 'http://localhost:4321/',
    SESSION_E2E_BILLING_URL: 'https://testbilling.comfy.org',
    SESSION_E2E_EXTRA_ORIGINS: 'https://challenges.cloudflare.com'
  })

  it('maps only sites that have a local upstream', () => {
    expect([...mappedOrigins(env)]).toEqual([
      ['https://www.comfy.org', 'http://localhost:4321']
    ])
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

  it('names the variables a test still needs', () => {
    expect(
      missingSessionEnv(env, ['SESSION_E2E_CLOUD_URL', 'SESSION_E2E_EMAIL'])
    ).toEqual(['SESSION_E2E_EMAIL'])
  })
})

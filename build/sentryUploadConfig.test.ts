import { describe, expect, it } from 'vitest'

import { resolveSentryUploadConfig } from './sentryUploadConfig'

describe('resolveSentryUploadConfig', () => {
  it('uses one upload configuration for staging and production', () => {
    expect(
      resolveSentryUploadConfig({
        distribution: 'cloud',
        isDev: false,
        env: {
          SENTRY_AUTH_TOKEN: 'token',
          SENTRY_ORG: 'comfy-org',
          SENTRY_PROJECT: 'cloud-frontend-staging',
          SENTRY_PROJECT_PROD: 'cloud-frontend-prod'
        }
      })
    ).toEqual({
      authToken: 'token',
      org: 'comfy-org',
      projects: ['cloud-frontend-staging', 'cloud-frontend-prod']
    })
  })

  it('fails a partially configured upload instead of shipping unmapped assets', () => {
    expect(() =>
      resolveSentryUploadConfig({
        distribution: 'cloud',
        isDev: false,
        env: {
          SENTRY_AUTH_TOKEN: 'token',
          SENTRY_ORG: 'comfy-org',
          SENTRY_PROJECT: 'cloud-frontend-staging'
        }
      })
    ).toThrow('missing SENTRY_PROJECT_PROD')
  })

  it('does not require upload credentials when uploads are not configured', () => {
    expect(
      resolveSentryUploadConfig({
        distribution: 'cloud',
        isDev: false,
        env: {}
      })
    ).toBeUndefined()
  })
})

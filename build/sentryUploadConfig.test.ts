import { describe, expect, it } from 'vitest'

import {
  hasCompleteSentryUploadConfig,
  resolveSentryUploadConfig
} from './sentryUploadConfig'

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
      project: ['cloud-frontend-staging', 'cloud-frontend-prod']
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

  it('rejects one project used for staging and production', () => {
    expect(() =>
      resolveSentryUploadConfig({
        distribution: 'cloud',
        isDev: false,
        env: {
          SENTRY_AUTH_TOKEN: 'token',
          SENTRY_ORG: 'comfy-org',
          SENTRY_PROJECT: 'cloud-frontend',
          SENTRY_PROJECT_PROD: 'cloud-frontend'
        }
      })
    ).toThrow('must name different projects')
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

  it.for([
    { name: 'development', distribution: 'cloud' as const, isDev: true },
    { name: 'non-cloud', distribution: 'desktop' as const, isDev: false }
  ])('does not upload in $name builds', ({ distribution, isDev }) => {
    expect(
      resolveSentryUploadConfig({
        distribution,
        isDev,
        env: {
          SENTRY_AUTH_TOKEN: 'token',
          SENTRY_ORG: 'comfy-org',
          SENTRY_PROJECT: 'cloud-frontend-staging',
          SENTRY_PROJECT_PROD: 'cloud-frontend-prod'
        }
      })
    ).toBeUndefined()
  })

  it('distinguishes complete configuration from partial configuration', () => {
    expect(
      hasCompleteSentryUploadConfig({
        SENTRY_AUTH_TOKEN: 'token',
        SENTRY_ORG: 'comfy-org',
        SENTRY_PROJECT: 'cloud-frontend-staging',
        SENTRY_PROJECT_PROD: 'cloud-frontend-prod'
      })
    ).toBe(true)
    expect(hasCompleteSentryUploadConfig({ SENTRY_AUTH_TOKEN: 'token' })).toBe(
      false
    )
  })
})

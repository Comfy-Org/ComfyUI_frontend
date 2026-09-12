import { describe, expect, it, vi } from 'vitest'

import {
  liveCloudBillingConfigSchema,
  loadLiveCloudBillingConfig
} from '@e2e/fixtures/utils/liveCloudBillingConfig'

const sandboxConfig = {
  PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
  PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org',
  CLOUD_ACCOUNT_EMAIL: 'billing-e2e@example.com',
  CLOUD_ACCOUNT_PASSWORD: 'test-password'
}

describe('Live Cloud billing prerequisites', () => {
  it.for([
    'https://cloud.comfy.org',
    'https://testcloud.comfy.org.example.com',
    'https://testcloud.comfy.org/redirect',
    'http://testcloud.comfy.org',
    'not-a-url'
  ])('rejects an unsafe backend: %s', (PLAYWRIGHT_SETUP_API_URL) => {
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        PLAYWRIGHT_SETUP_API_URL
      }).success
    ).toBe(false)
  })

  it('rejects a production frontend with sandbox account credentials', () => {
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        PLAYWRIGHT_TEST_URL: 'https://cloud.comfy.org'
      }).success
    ).toBe(false)
  })

  it('accepts a local frontend backed by test Cloud', () => {
    expect(liveCloudBillingConfigSchema.safeParse(sandboxConfig).success).toBe(
      true
    )
  })

  it('accepts an isolated preview deployment', () => {
    const target = 'https://pr-8978.testenvs.comfy.org'
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        PLAYWRIGHT_TEST_URL: target,
        PLAYWRIGHT_SETUP_API_URL: target
      }).success
    ).toBe(true)
  })

  it('reports missing prerequisites without leaking credentials', () => {
    vi.stubEnv('CLOUD_ACCOUNT_PASSWORD', 'private-value')
    vi.stubEnv('CLOUD_ACCOUNT_EMAIL', undefined)
    expect(loadLiveCloudBillingConfig).toThrow('CLOUD_ACCOUNT_EMAIL')
    expect(loadLiveCloudBillingConfig).not.toThrow('private-value')
  })
})

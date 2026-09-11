import { describe, expect, it, vi } from 'vitest'

import {
  liveCloudBillingConfigSchema,
  loadLiveCloudBillingConfig
} from '@e2e/fixtures/utils/liveCloudBillingConfig'

const sandboxConfig = {
  baseURL: 'https://testcloud.comfy.org',
  storageState: '/private/cloud-billing-auth.json',
  workspaceId: '12345678-1234-4234-8234-123456789abc',
  resetScript: '/private/reset-cloud-billing',
  allowedOrigins: ['https://checkout.stripe.com']
}

describe('Live Cloud billing target validation', () => {
  it.for([
    'https://cloud.comfy.org',
    'https://testcloud.comfy.org.example.com',
    'https://testcloud.comfy.org/redirect',
    'http://testcloud.comfy.org',
    'not-a-url'
  ])('rejects an unsafe target: %s', (baseURL) => {
    expect(
      liveCloudBillingConfigSchema.safeParse({ ...sandboxConfig, baseURL })
        .success
    ).toBe(false)
  })

  it('rejects production Cloud as an allowed dependency', () => {
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        allowedOrigins: ['https://cloud.comfy.org']
      }).success
    ).toBe(false)
  })

  it('accepts an isolated preview deployment', () => {
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        baseURL: 'https://pr-8978.testenvs.comfy.org'
      }).success
    ).toBe(true)
  })

  it('fails when sandbox configuration is missing', () => {
    vi.stubEnv('CLOUD_BILLING_CONFIG', undefined)
    expect(loadLiveCloudBillingConfig).toThrow('Set CLOUD_BILLING_CONFIG')
  })
})

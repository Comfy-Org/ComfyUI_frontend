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
  it('routes an omitted backend to the Staging customer API', () => {
    const selected = liveCloudBillingConfigSchema.parse({
      PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
      CLOUD_ACCOUNT_EMAIL: sandboxConfig.CLOUD_ACCOUNT_EMAIL,
      CLOUD_ACCOUNT_PASSWORD: sandboxConfig.CLOUD_ACCOUNT_PASSWORD
    })
    expect(selected.PLAYWRIGHT_SETUP_API_URL).toBe(
      'https://stagingcloud.comfy.org'
    )
    expect(selected.customerOrigin).toBe('https://stagingapi.comfy.org')
  })

  it.for([
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

  it.for([
    ['https://stagingcloud.comfy.org', 'https://stagingapi.comfy.org'],
    ['https://testcloud.comfy.org', 'https://testapi.comfy.org'],
    ['https://cloud.comfy.org', 'https://api.comfy.org']
  ])('selects the matching customer API for %s', ([backend, customer]) => {
    const selected = liveCloudBillingConfigSchema.parse({
      ...sandboxConfig,
      PLAYWRIGHT_SETUP_API_URL: backend
    })
    expect(selected.customerOrigin).toBe(customer)
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
    vi.stubEnv('PLAYWRIGHT_TEST_URL', 'http://localhost:5173')
    vi.stubEnv('CLOUD_ACCOUNT_PASSWORD', 'private-value')
    vi.stubEnv('CLOUD_ACCOUNT_EMAIL', undefined)
    expect(loadLiveCloudBillingConfig).toThrow('CLOUD_ACCOUNT_EMAIL')
    expect(loadLiveCloudBillingConfig).not.toThrow('private-value')
  })
})

describe('Frontend origins', () => {
  it.for([
    'http://localhost:5173/app',
    'http://localhost:5173/?x=1',
    'http://localhost:5173/#x',
    'http://user:pass@localhost:5173'
  ])('rejects non-origin frontend %s', (PLAYWRIGHT_TEST_URL) => {
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...sandboxConfig,
        PLAYWRIGHT_TEST_URL
      }).success
    ).toBe(false)
  })

  it('normalizes root trailing slashes on both origins', () => {
    const config = liveCloudBillingConfigSchema.parse({
      ...sandboxConfig,
      PLAYWRIGHT_TEST_URL: 'http://localhost:5173/',
      PLAYWRIGHT_SETUP_API_URL: 'https://testcloud.comfy.org/'
    })
    expect(config.PLAYWRIGHT_TEST_URL).toBe('http://localhost:5173')
    expect(config.PLAYWRIGHT_SETUP_API_URL).toBe('https://testcloud.comfy.org')
  })
})

describe('Disposable billing account boundaries', () => {
  it.for(['allowPayments', 'allowAccountCreation'])(
    'rejects %s in production',
    (permission) => {
      expect(
        liveCloudBillingConfigSchema.safeParse({
          ...sandboxConfig,
          PLAYWRIGHT_SETUP_API_URL: 'https://cloud.comfy.org',
          [permission]: true
        }).success
      ).toBe(false)
    }
  )

  it('requires permanent credentials unless creating a sandbox account', () => {
    const config = { PLAYWRIGHT_TEST_URL: sandboxConfig.PLAYWRIGHT_TEST_URL }
    expect(liveCloudBillingConfigSchema.safeParse(config).success).toBe(false)
    expect(
      liveCloudBillingConfigSchema.safeParse({
        ...config,
        allowAccountCreation: true
      }).success
    ).toBe(true)
  })
})

import assert from 'node:assert/strict'

import {
  zBillingStatusResponse,
  zListSavedPaymentMethodsResponse
} from '@comfyorg/ingest-types/zod'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
import { liveCloudBillingFixture as base } from '@e2e/fixtures/liveCloudBillingFixture'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'

const test = base.extend({
  liveCloudBillingConfig: async ({}, use) => {
    const config = loadLiveCloudBillingConfig({ allowCheckout: true })
    expect(config.PLAYWRIGHT_TEST_URL).toMatch(
      /^https:\/\/(testcloud|stagingcloud)\.comfy\.org$/
    )
    expect(config.PLAYWRIGHT_SETUP_API_URL).toBe(config.PLAYWRIGHT_TEST_URL)
    expect(process.env.CLOUD_EXPECTED_FRONTEND_SHA).toMatch(/^[a-f0-9]{40}$/)
    await use(config)
  },
  billingSession: async ({ page, liveCloudBillingConfig }, use) => {
    assert(liveCloudBillingConfig)
    await verifyVersion(page, liveCloudBillingConfig.PLAYWRIGHT_TEST_URL)
    await use(await signInToLiveCloud(page, liveCloudBillingConfig))
    await verifyVersion(page, liveCloudBillingConfig.PLAYWRIGHT_TEST_URL)
  }
})

async function verifyVersion(page: Page, origin: string) {
  const response = await page.request.get(origin, {
    headers: { 'Cache-Control': 'no-cache' }
  })
  expect(response.status()).toBe(200)
  const deployed = response.headers()['x-frontend-version']
  expect(deployed).toMatch(/^[a-f0-9]{7,40}$/)
  expect(process.env.CLOUD_EXPECTED_FRONTEND_SHA).toMatch(
    new RegExp(`^${deployed}`)
  )
}

test.describe(
  'Deployed Cloud release smoke',
  { tag: ['@cloud-live', '@smoke'] },
  () => {
    test('signs in and opens sandbox checkout', async ({
      comfyPage,
      billingSession
    }, testInfo) => {
      await expect(comfyPage.canvas).toBeVisible()
      await billingSession.assertNoCardAccount(testInfo)
      const status = await billingSession.read(
        '/api/billing/status',
        zBillingStatusResponse
      )
      expect(status.is_active).toBe(false)
      expect(['FREE', undefined]).toContain(status.subscription_tier)
      expect(
        await billingSession.read(
          '/api/billing/payment-methods',
          zListSavedPaymentMethodsResponse
        )
      ).toHaveLength(0)

      const origin = new URL(comfyPage.page.url()).origin
      const billing = new LiveCloudCheckout(comfyPage, origin, origin)
      await billing.open()
      const { checkout } = await billing.startCheckout()
      await expect(
        checkout.getByLabel('Card number', { exact: true })
      ).toBeEditable()
      await expect(
        checkout.getByLabel('Expiration', { exact: true })
      ).toBeEditable()
      await checkout.close()
    })
  }
)

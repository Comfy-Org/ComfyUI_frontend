import type { Page } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Minimal valid billing shapes so the billing facade resolves while a
 * subscription dialog mounts. Active personal sub with zero balance.
 */
export async function mockBilling(page: Page) {
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(
      jsonRoute({
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_tier: 'pro',
        subscription_duration: 'MONTHLY',
        billing_status: 'paid'
      })
    )
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
  await page.route('**/customers/cloud-subscription-status', (r) =>
    r.fulfill(jsonRoute({ is_active: false }))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
}

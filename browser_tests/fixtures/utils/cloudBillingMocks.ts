import type { Page } from '@playwright/test'
import type {
  BillingCapabilitiesResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

interface MockBillingOptions {
  workspaceId?: string
  billingStatus?: BillingStatusResponse
  billingCapabilities?:
    | BillingCapabilitiesResponse
    | Promise<BillingCapabilitiesResponse>
  billingCapabilitiesStatus?: number
}

/**
 * Minimal valid billing shapes so the billing facade resolves while a
 * subscription dialog mounts. Active personal sub with zero balance.
 */
export async function mockBilling(
  page: Page,
  {
    workspaceId = 'ws-personal',
    billingStatus = {
      is_active: true,
      has_funds: true,
      subscription_status: 'active',
      subscription_tier: 'PRO',
      subscription_duration: 'MONTHLY',
      billing_status: 'paid',
      max_seats: 1,
      occupied_seats: 1,
      team_credit_stop: null
    },
    billingCapabilities = createBillingCapabilities(workspaceId),
    billingCapabilitiesStatus
  }: MockBillingOptions = {}
) {
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(billingStatus))
  )
  await page.route('**/api/billing/capabilities', async (r) => {
    if (r.request().method() !== 'GET') return r.fallback()
    if (billingCapabilitiesStatus !== undefined) {
      await r.fulfill({ status: billingCapabilitiesStatus })
      return
    }
    await r.fulfill(jsonRoute(await billingCapabilities))
  })
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
}

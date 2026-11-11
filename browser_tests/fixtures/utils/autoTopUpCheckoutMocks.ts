import type { Page, Request } from '@playwright/test'
import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  AUTO_TOP_UP_CHECKOUT,
  AUTO_TOP_UP_CHECKOUT_SESSION_ID,
  AUTO_TOP_UP_OFF,
  DEFAULT_VISA,
  FIFTY_DOLLAR_QUOTE
} from '@e2e/fixtures/data/autoTopUpAtCheckout'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const PERSONAL_WORKSPACE = workspace('personal', 'owner')

/** Boots the cloud app for a hosted top-up whose checkout read serves `activation`; returns the checkout requests sent. */
export async function mockAutoTopUpPurchase(
  page: Page,
  {
    activation,
    atCheckout
  }: { activation: HostedTopupCheckout; atCheckout: boolean }
): Promise<Request[]> {
  const checkoutRequests: Request[] = []
  await setupCloudApp(page, {
    workspace: PERSONAL_WORKSPACE,
    features: {
      unified_cloud_auth: true,
      billing_new_ux_enabled: true,
      billing_auto_top_up_at_checkout_enabled: atCheckout
    } satisfies RemoteConfig,
    billingCapabilities: {
      ...createBillingCapabilities(PERSONAL_WORKSPACE.id, {
        can_manage_auto_top_up: true,
        can_view_auto_top_up: true
      }),
      auto_top_up_enabled: true,
      auto_top_up_setup: { state: 'ready' }
    }
  })
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill({ json: [DEFAULT_VISA] })
  )
  await page.route('**/api/billing/topup/quote', (route) =>
    route.fulfill({ json: FIFTY_DOLLAR_QUOTE })
  )
  await page.route('**/api/billing/auto-reload', (route) =>
    route.fulfill({ json: AUTO_TOP_UP_OFF })
  )
  await page.route('**/api/billing/topup/checkout', (route) => {
    checkoutRequests.push(route.request())
    return route.fulfill({ json: AUTO_TOP_UP_CHECKOUT })
  })
  await page.route(
    `**/api/billing/topup/checkouts/${AUTO_TOP_UP_CHECKOUT_SESSION_ID}`,
    (route) => route.fulfill({ json: activation })
  )
  await page
    .context()
    .route(AUTO_TOP_UP_CHECKOUT.checkout_url, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'checkout' })
    )
  return checkoutRequests
}

import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  CreateTopupCheckoutResponse,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { recordOpenedUrl } from '@e2e/fixtures/utils/recordOpenedUrl'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const BOOT_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true
} satisfies RemoteConfig

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_fe2475'

const OPENING_BALANCE = {
  amount_micros: 10_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

const TOPPED_UP_BALANCE = {
  amount_micros: 60_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

interface CheckoutRoutes {
  readonly checkoutRequests: Request[]
  readonly purchaseRequests: Request[]
  respondNotFound: () => void
  creditBalance: () => void
}

async function setupCheckout(page: Page): Promise<CheckoutRoutes> {
  const ws = workspace('personal', 'owner')
  const checkoutRequests: Request[] = []
  const purchaseRequests: Request[] = []
  let notFound = false
  let served: BillingBalanceResponse = OPENING_BALANCE

  await setupCloudApp(page, {
    workspace: ws,
    features: BOOT_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(served))
  )
  await page.route('**/api/billing/topup/quote', (route) =>
    route.fulfill(
      jsonRoute({
        amount_cents: 5_000,
        credits: 10_550,
        expires_at: '2099-01-01T00:00:00Z'
      } satisfies TopupQuoteResponse)
    )
  )
  await page.route('**/api/billing/topup/checkout', async (route) => {
    checkoutRequests.push(route.request())
    if (notFound) {
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill(
      jsonRoute({
        checkout_url: CHECKOUT_URL
      } satisfies CreateTopupCheckoutResponse)
    )
  })
  await page.route('**/api/billing/topup', (route) => {
    purchaseRequests.push(route.request())
    return route.fulfill({ status: 500 })
  })

  return {
    checkoutRequests,
    purchaseRequests,
    respondNotFound: () => {
      notFound = true
    },
    creditBalance: () => {
      served = TOPPED_UP_BALANCE
    }
  }
}

function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

function transport(request: Request): string {
  return request.resourceType()
}

async function enableSdkRail(page: Page) {
  await new FeatureFlagHelper(page).seedServerFlags({
    billing_sdk_topup_enabled: true
  })
}

async function openTopUpAndContinue(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  await dialog.continueButton.click()
  return dialog
}

async function expectHandOffThenLanding(
  page: Page,
  routes: CheckoutRoutes,
  dialog: TopUpCreditsDialog
) {
  await expect(dialog.openedHeading).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute(
    'data-opened-url',
    CHECKOUT_URL
  )
  routes.creditBalance()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(dialog.root).toBeHidden()
  expect(routes.purchaseRequests).toHaveLength(0)
}

test.describe('Top-up checkout rail (FE-2475)', { tag: '@cloud' }, () => {
  test('keeps the legacy call while the rail is off', async ({ page }) => {
    test.setTimeout(60_000)
    await recordOpenedUrl(page)
    const routes = await setupCheckout(page)

    const dialog = await openTopUpAndContinue(page)

    await expect.poll(() => routes.checkoutRequests.length).toBe(1)
    const [issued] = routes.checkoutRequests
    expect(transport(issued)).toBe('xhr')
    expect(idempotencyKey(issued)).toBeUndefined()
    await expectHandOffThenLanding(page, routes, dialog)
  })

  test('issues through the SDK transport while the rail is on', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await recordOpenedUrl(page)
    const routes = await setupCheckout(page)
    await enableSdkRail(page)

    const dialog = await openTopUpAndContinue(page)

    await expect.poll(() => routes.checkoutRequests.length).toBe(1)
    const [issued] = routes.checkoutRequests
    expect(issued.method()).toBe('POST')
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      amount_cents: 5_000,
      idempotency_key: idempotencyKey(issued)
    })
    await expectHandOffThenLanding(page, routes, dialog)
  })

  test('surfaces a closed backend gate as a checkout that did not open, with no legacy retry', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupCheckout(page)
    await enableSdkRail(page)
    routes.respondNotFound()

    const dialog = await openTopUpAndContinue(page)

    await expect(dialog.notice).toHaveAttribute(
      'data-notice',
      'checkout_failed'
    )
    expect(routes.checkoutRequests.map(transport)).toEqual(['fetch'])
    expect(routes.purchaseRequests).toHaveLength(0)
  })
})

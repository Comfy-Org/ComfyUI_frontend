import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type { CreateTopupCheckoutResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const BOOT_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true
} satisfies RemoteConfig

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_e2e_rail'

interface TopupRoutes {
  readonly checkoutRequests: Request[]
  readonly chargeRequests: Request[]
  respondNotFound: () => void
}

async function setupTopUp(page: Page): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const checkoutRequests: Request[] = []
  const chargeRequests: Request[] = []
  let notFound = false

  await page.addInitScript(() => {
    const standInTab = new Proxy(window, {
      get: (target, property) =>
        property === 'location'
          ? { set href(_destination: string) {} }
          : property === 'close'
            ? () => {}
            : Reflect.get(target, property),
      set: () => true
    })
    window.open = () => standInTab
  })

  await setupCloudApp(page, {
    workspace: ws,
    features: BOOT_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })

  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    chargeRequests.push(route.request())
    return route.fulfill({ status: 500, body: '' })
  })
  await page.route('**/api/billing/topup/checkout', async (route) => {
    checkoutRequests.push(route.request())
    if (notFound) {
      notFound = false
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill(
      jsonRoute({
        checkout_url: CHECKOUT_URL
      } satisfies CreateTopupCheckoutResponse)
    )
  })

  return {
    checkoutRequests,
    chargeRequests,
    respondNotFound: () => {
      notFound = true
    }
  }
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

/** Which transport issued the request, and so which rail served it. */
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
  await dialog.continueToPaymentButton.click()
  return dialog
}

test.describe('Top-up rail (FE-2475)', { tag: '@cloud' }, () => {
  test('keeps the legacy call while the rail is off', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)

    const dialog = await openTopUpAndContinue(page)

    await expect(dialog.checkoutOpenedHeading).toBeVisible()
    expect(routes.checkoutRequests).toHaveLength(1)
    const [issued] = routes.checkoutRequests
    expect(transport(issued)).toBe('xhr')
    expect(idempotencyKey(issued)).toBeUndefined()
    expect(issued.postDataJSON()).toMatchObject({ amount_cents: 5_000 })
    expect(routes.chargeRequests).toHaveLength(0)
  })

  test('issues through the SDK transport while the rail is on', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)
    await enableSdkRail(page)

    const dialog = await openTopUpAndContinue(page)

    await expect(dialog.checkoutOpenedHeading).toBeVisible()
    expect(routes.checkoutRequests).toHaveLength(1)
    const [issued] = routes.checkoutRequests
    expect(issued.method()).toBe('POST')
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      amount_cents: 5_000,
      idempotency_key: idempotencyKey(issued)
    })
    expect(routes.chargeRequests).toHaveLength(0)
  })

  test('links to the session it created when the browser blocks the tab', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)
    await page.addInitScript(() => {
      window.open = () => null
    })
    await page
      .context()
      .route(CHECKOUT_URL, (route) =>
        route.fulfill({ contentType: 'text/html', body: 'checkout' })
      )

    const dialog = await openTopUpAndContinue(page)

    await expect(
      dialog.root.getByRole('heading', { name: "Checkout didn't open" })
    ).toBeVisible()
    const link = dialog.root.getByRole('link', { name: 'Open checkout' })
    await expect(link).toHaveAttribute('href', CHECKOUT_URL)
    await expect(link).toHaveAttribute('target', '_blank')

    const checkoutPage = page.context().waitForEvent('page')
    await link.click()

    await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
    await expect(dialog.checkoutOpenedHeading).toBeVisible()
    expect(routes.checkoutRequests).toHaveLength(1)
  })

  test('keeps the amount step and explains a closed backend gate', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)
    await enableSdkRail(page)
    routes.respondNotFound()

    const dialog = await openTopUpAndContinue(page)

    await expect(dialog.root.getByRole('alert')).toHaveText(
      "The payment page couldn't open. Nothing was charged. Try again."
    )
    expect(routes.checkoutRequests).toHaveLength(1)
    expect(transport(routes.checkoutRequests[0])).toBe('fetch')
    await expect(dialog.continueToPaymentButton).toBeEnabled()
  })
})

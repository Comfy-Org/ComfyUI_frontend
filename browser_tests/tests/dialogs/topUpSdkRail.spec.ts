import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  CreateTopupResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'
import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

/**
 * Buying credits across the billing SDK rail — FE-2475.
 *
 * Comfy-Org/ComfyUI_frontend#17665 shipped the top-up rail with 48 dual-path
 * unit tests and no browser coverage, which left the first flow due to be
 * flagged on in staging as the one with no end-to-end proof.
 *
 * Both rails POST `/api/billing/topup`, so the body cannot separate them. The
 * transport can: the SDK runs on `fetch`, the legacy workspace client on axios'
 * XHR adapter, and only the SDK sends an `Idempotency-Key` — the same pair of
 * discriminators `planChangeSdkRail` uses.
 */
const BOOT_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true
} satisfies RemoteConfig

const TOPUP_OPERATION_ID = 'op-e2e-topup'

const SAVED_CARD = {
  id: 'pm_e2e_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

const PURCHASED = {
  billing_op_id: TOPUP_OPERATION_ID,
  topup_id: 'topup-e2e',
  status: 'completed',
  amount_cents: 5_000
} satisfies CreateTopupResponse

const SETTLED_OPERATION = {
  id: TOPUP_OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-20T00:00:00Z',
  completed_at: '2026-09-20T00:00:03Z'
} satisfies BillingOpStatusResponse

/** The balance the app reads back after a purchase settles, on either rail. */
const REFRESHED_BALANCE = {
  amount_micros: 50_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

interface TopupRoutes {
  /** Every POST to the purchase route, in order. */
  readonly purchaseRequests: Request[]
  /** Every read of the balance, in order — the refresh after settlement. */
  readonly balanceRequests: Request[]
  /** Answers the next purchase with a 404, as a closed backend gate does. */
  respondNotFound: () => void
}

async function setupTopUp(page: Page): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const purchaseRequests: Request[] = []
  const balanceRequests: Request[] = []
  let notFound = false

  await setupCloudApp(page, {
    workspace: ws,
    features: BOOT_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })

  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([SAVED_CARD] satisfies SavedPaymentMethod[]))
  )
  // Registered after setupCloudApp so it wins over the flat balance that mock
  // installs: the point of the last row is that the balance is re-read.
  await page.route('**/api/billing/balance', (route) => {
    balanceRequests.push(route.request())
    return route.fulfill(jsonRoute(REFRESHED_BALANCE))
  })
  await page.route('**/api/billing/topup', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    purchaseRequests.push(route.request())
    if (notFound) {
      notFound = false
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill(jsonRoute(PURCHASED))
  })
  // Only the SDK rail observes the operation; the legacy path reports the
  // completed status straight from the purchase body.
  await page.route(`**/api/billing/ops/${TOPUP_OPERATION_ID}`, (route) =>
    route.fulfill(jsonRoute(SETTLED_OPERATION))
  )

  return {
    purchaseRequests,
    balanceRequests,
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

async function openTopUpAndPay(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  await dialog.root
    .getByRole('button', { name: 'Add credits', exact: true })
    .click()
  await dialog.root.getByRole('button', { name: 'Pay $50.00' }).click()
  return dialog
}

test.describe('Top-up rail (FE-2475)', { tag: '@cloud' }, () => {
  test('keeps the legacy call while the rail is off', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)

    await openTopUpAndPay(page)

    await expect.poll(() => routes.purchaseRequests.length).toBe(1)
    const [issued] = routes.purchaseRequests
    expect(transport(issued)).toBe('xhr')
    expect(idempotencyKey(issued)).toBeUndefined()
    // The balance is re-read once the purchase completes, on this rail too.
    await expect.poll(() => routes.balanceRequests.length).toBeGreaterThan(1)
  })

  test('issues through the SDK transport while the rail is on', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)
    await enableSdkRail(page)

    await openTopUpAndPay(page)

    await expect.poll(() => routes.purchaseRequests.length).toBe(1)
    const [issued] = routes.purchaseRequests
    expect(issued.method()).toBe('POST')
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      amount_cents: 5_000,
      idempotency_key: idempotencyKey(issued)
    })
    await expect.poll(() => routes.balanceRequests.length).toBeGreaterThan(1)
  })

  /**
   * Pins what the rail does today when the backend gate is still closed, which
   * is not what FE-2475 assumed. `account-core` maps a 404 to a `NOT_AVAILABLE`
   * failure (`topup.ts:226`), but no host call site reads that code: there is no
   * latch and no legacy retry for top-up, unlike the subscription rail's
   * `subscriptionRouteAvailable` in `billingSdkStore.ts:334`. So the purchase
   * surfaces as an error and the customer is left to try again.
   *
   * Asserting the real behaviour rather than the intended one keeps this spec
   * honest; closing the gap needs its own change, and this row will be the one
   * that has to be rewritten when it lands.
   */
  test('surfaces a closed backend gate as a failed purchase, with no legacy retry', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)
    await enableSdkRail(page)
    routes.respondNotFound()

    await openTopUpAndPay(page)

    await expect.poll(() => routes.purchaseRequests.length).toBe(1)
    expect(transport(routes.purchaseRequests[0])).toBe('fetch')
    await expect(
      page.locator('.p-toast-message.p-toast-message-error')
    ).toBeVisible()
  })
})

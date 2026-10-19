import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupCheckoutResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const OPERATION_ID = 'op-e2e-topup-outcome'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_e2e_outcome'

const RAIL_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_topup_enabled: true
} satisfies RemoteConfig

const BALANCE = {
  amount_micros: 10_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

const STARTED_AT = '2026-09-20T00:00:00Z'

function operation(
  fields: Omit<BillingOpStatusResponse, 'id' | 'started_at'>
): BillingOpStatusResponse {
  return { id: OPERATION_ID, started_at: STARTED_AT, ...fields }
}

/** The workspace's billing status, naming the top-up it still has open, if any. */
function billingStatus(pendingTopupId?: string): BillingStatusResponse {
  return {
    is_active: true,
    has_funds: true,
    subscription_status: 'active',
    subscription_tier: 'PRO',
    subscription_duration: 'MONTHLY',
    billing_status: 'paid',
    max_seats: 1,
    occupied_seats: 1,
    team_credit_stop: null,
    scheduled_change: null,
    ...(pendingTopupId === undefined
      ? {}
      : {
          pending_billing_op_id: pendingTopupId,
          pending_billing_op_type: 'topup'
        })
  }
}

interface TopupRoutes {
  readonly checkoutRequests: Request[]
  readonly chargeRequests: Request[]
  readonly pollRequests: Request[]
  payOnHostedCheckout: () => void
  /** What the next poll of the operation answers. */
  setOperation: (next: BillingOpStatusResponse) => void
  checkoutOpens: () => Promise<string[]>
}

async function setupTopUp(page: Page): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const checkoutRequests: Request[] = []
  const chargeRequests: Request[] = []
  const pollRequests: Request[] = []
  let pendingTopupId: string | undefined
  let current = operation({ status: 'pending', phase: 'in_progress' })

  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__checkoutOpens', { get: () => opened })
    const standInTab = new Proxy(window, {
      get: (target, property) =>
        property === 'location'
          ? {
              set href(destination: string) {
                opened.push(destination)
              }
            }
          : Reflect.get(target, property),
      set: () => true
    })
    window.open = () => standInTab
  })

  await setupCloudApp(page, {
    workspace: ws,
    features: RAIL_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_topup_enabled: true
  })

  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(BALANCE))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(billingStatus(pendingTopupId)))
  )
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([]))
  )
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    chargeRequests.push(route.request())
    return route.fulfill({ status: 500, body: '' })
  })
  await page.route('**/api/billing/topup/checkout', (route) => {
    checkoutRequests.push(route.request())
    return route.fulfill(
      jsonRoute({
        checkout_url: CHECKOUT_URL
      } satisfies CreateTopupCheckoutResponse)
    )
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    if (current.status !== 'pending') pendingTopupId = undefined
    return route.fulfill(jsonRoute(current))
  })

  return {
    checkoutRequests,
    chargeRequests,
    pollRequests,
    payOnHostedCheckout: () => {
      pendingTopupId = OPERATION_ID
    },
    setOperation: (next) => {
      current = next
    },
    checkoutOpens: () =>
      page.evaluate(() => [
        ...(window as unknown as { __checkoutOpens: string[] }).__checkoutOpens
      ])
  }
}

/** A customer returning to the tab: the rail polls every pending operation now. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function openTopUp(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  return dialog
}

test.describe('Top-up rail outcomes', { tag: '@cloud' }, () => {
  test('hands off to the hosted checkout and closes once the server settles the top-up', async ({
    page,
    toast
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page)

    const dialog = await openTopUp(page)
    await dialog.continueToPaymentButton.click()

    await expect(dialog.checkoutOpenedHeading).toBeVisible()
    await expect.poll(() => routes.checkoutOpens()).toEqual([CHECKOUT_URL])

    routes.payOnHostedCheckout()
    await expect
      .poll(() => routes.pollRequests.length, { timeout: 15_000 })
      .toBeGreaterThan(0)
    await expect(dialog.checkoutOpenedHeading).toBeVisible()

    routes.setOperation(
      operation({ status: 'succeeded', completed_at: '2026-09-20T00:01:00Z' })
    )
    await returnToTab(page)

    await expect(
      toast.toastSuccesses.filter({ hasText: 'Credits added successfully' })
    ).toBeVisible()
    await expect(dialog.root).toBeHidden()
    expect(routes.checkoutRequests).toHaveLength(1)
    expect(routes.checkoutRequests[0].resourceType()).toBe('fetch')
    expect(routes.chargeRequests).toHaveLength(0)
  })

  test('creates one checkout for a double-clicked Continue to payment', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page)

    const dialog = await openTopUp(page)
    await dialog.continueToPaymentButton.dblclick()

    await expect(dialog.checkoutOpenedHeading).toBeVisible()
    expect(routes.checkoutRequests).toHaveLength(1)
  })
})

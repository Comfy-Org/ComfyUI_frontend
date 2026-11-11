import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  AutoReloadSettings,
  BillingBalanceResponse,
  CreateTopupCheckoutResponse,
  HostedTopupCheckout,
  ListSavedPaymentMethodsResponse,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_front3912'
const SESSION_ID = 'cs_test_front3912'
const PERSONAL_WORKSPACE = workspace('personal', 'owner')

const DEFAULT_VISA: ListSavedPaymentMethodsResponse[number] = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
}

const AUTO_TOP_UP_OFF: AutoReloadSettings = {
  card_expiry: null,
  configured: false,
  cycle_resets_at: null,
  declined_payment_method: null,
  disabled_reason: null,
  enabled: false,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 6_000_000,
  max_reload_credits: 12_660_000,
  min_reload_credits: 1055,
  monthly_budget_cents: null,
  monthly_budget_is_default: false,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'off',
  target_credits: null,
  threshold_credits: null
}

function balance(amountMicros: number): BillingBalanceResponse {
  return {
    amount_micros: amountMicros,
    currency: 'usd',
    effective_balance_micros: amountMicros
  }
}

async function mockAutoTopUpPurchase(
  page: Page,
  {
    activation,
    atCheckout
  }: { activation: HostedTopupCheckout; atCheckout: boolean }
): Promise<Request[]> {
  const checkoutRequests: Request[] = []
  // The saved-cards read rides the unified Cloud session, which only the cloud build mints.
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
    route.fulfill({
      json: [DEFAULT_VISA] satisfies ListSavedPaymentMethodsResponse
    })
  )
  await page.route('**/api/billing/topup/quote', (route) =>
    route.fulfill({
      json: {
        amount_cents: 5000,
        credits: 10_550,
        expires_at: '2099-01-01T00:00:00Z'
      } satisfies TopupQuoteResponse
    })
  )
  await page.route('**/api/billing/auto-reload', (route) =>
    route.fulfill({ json: AUTO_TOP_UP_OFF })
  )
  await page.route('**/api/billing/topup/checkout', (route) => {
    checkoutRequests.push(route.request())
    return route.fulfill({
      json: {
        checkout_url: CHECKOUT_URL,
        session_id: SESSION_ID
      } satisfies CreateTopupCheckoutResponse
    })
  })
  await page.route(`**/api/billing/topup/checkouts/${SESSION_ID}`, (route) =>
    route.fulfill({ json: activation })
  )
  await page
    .context()
    .route(CHECKOUT_URL, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'checkout' })
    )
  return checkoutRequests
}

async function openAddCredits(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  return dialog
}

async function payAndReturn(page: Page, dialog: TopUpCreditsDialog) {
  const checkoutPage = page.context().waitForEvent('page')
  await dialog.continueButton.click()
  await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill({ json: balance(50_000_000) })
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

const ACTIVATED: HostedTopupCheckout = {
  session_id: SESSION_ID,
  amount_cents: 5000,
  payment_amount_cents: 5000,
  state: 'fulfilled',
  auto_top_up_activation: 'on',
  auto_top_up: {
    threshold_credits: 1000,
    target_credits: 11_550,
    monthly_budget_cents: 6_000_000,
    monthly_budget_is_default: true
  }
}

test.describe('Add credits auto top-up at checkout', { tag: '@cloud' }, () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('turns auto top-up on with the purchase when billing_auto_top_up_at_checkout_enabled is on', async ({
    page
  }) => {
    const checkoutRequests = await mockAutoTopUpPurchase(page, {
      activation: ACTIVATED,
      atCheckout: true
    })
    const dialog = await openAddCredits(page)

    await dialog.root
      .getByRole('checkbox', { name: /Turn on auto top-up/ })
      .click()
    await expect(dialog.root).toContainText(
      'Top-ups are charged to your default card, visa ···· 4242'
    )
    await payAndReturn(page, dialog)

    await test.step('the purchase carries the checked settings', async () => {
      await expect.poll(() => checkoutRequests.length).toBe(1)
      expect(checkoutRequests[0].postDataJSON()).toMatchObject({
        amount_cents: 5000,
        auto_top_up: {
          threshold_credits: 1000,
          target_credits: 11_550,
          monthly_budget_cents: null
        }
      })
    })

    await expect(
      dialog.root.getByTestId('add-credits-auto-top-up-on')
    ).toBeVisible()
  })

  test('offers no checkbox and sends no settings when billing_auto_top_up_at_checkout_enabled is off', async ({
    page
  }) => {
    const checkoutRequests = await mockAutoTopUpPurchase(page, {
      activation: ACTIVATED,
      atCheckout: false
    })
    const dialog = await openAddCredits(page)

    await expect(
      dialog.root.getByTestId('add-credits-auto-top-up')
    ).toHaveCount(0)
    await dialog.continueButton.click()

    await expect.poll(() => checkoutRequests.length).toBe(1)
    expect(checkoutRequests[0].postDataJSON()).not.toHaveProperty('auto_top_up')
  })
})

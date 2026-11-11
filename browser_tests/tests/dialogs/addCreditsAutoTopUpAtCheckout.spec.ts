import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  AutoReloadSettings,
  BillingBalanceResponse,
  CreateTopupCheckoutResponse,
  HostedTopupCheckout
} from '@comfyorg/ingest-types'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { installSeededServerFlags } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_front3912'
const SESSION_ID = 'cs_test_front3912'
const PERSONAL_WORKSPACE_ID = workspace('personal', 'owner').id

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
  activation: HostedTopupCheckout
): Promise<Request[]> {
  const checkoutRequests: Request[] = []
  await page.route('**/api/billing/capabilities', (route) =>
    route.fulfill({
      json: {
        ...createBillingCapabilities(PERSONAL_WORKSPACE_ID, {
          can_manage_auto_top_up: true,
          can_view_auto_top_up: true
        }),
        auto_top_up_enabled: true,
        auto_top_up_setup: { state: 'ready' }
      }
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
  await page.getByTestId(TestIds.user.currentUserButton).click()
  await page
    .getByTestId(TestIds.user.currentUserPopover)
    .getByTestId('credits-menu-item')
    .hover()
  await page.getByTestId('add-credits-button').click()
  await expect(dialog.heading).toBeVisible()
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

test.describe('Add credits auto top-up at checkout', { tag: '@ui' }, () => {
  // shortcut: the open card pushes Continue below a 720px viewport with no scroll (PR 23189); drop once the dialog scrolls.
  test.use({ viewport: { width: 1280, height: 1000 } })

  test('turns auto top-up on with the purchase when billing_auto_top_up_at_checkout_enabled is on', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.addInitScript(installSeededServerFlags, {
      billing_auto_top_up_at_checkout_enabled: true
    })
    const checkoutRequests = await mockAutoTopUpPurchase(page, ACTIVATED)
    await comfyPage.goto()
    await comfyPage.waitForAppReady()
    const dialog = await openAddCredits(page)

    await dialog.root
      .getByRole('checkbox', { name: /Turn on auto top-up/ })
      .click()
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
    comfyPage
  }) => {
    const page = comfyPage.page
    const checkoutRequests = await mockAutoTopUpPurchase(page, ACTIVATED)
    await comfyPage.goto()
    await comfyPage.waitForAppReady()
    const dialog = await openAddCredits(page)

    await expect(
      dialog.root.getByTestId('add-credits-auto-top-up')
    ).toHaveCount(0)
    await dialog.continueButton.click()

    await expect.poll(() => checkoutRequests.length).toBe(1)
    expect(checkoutRequests[0].postDataJSON()).not.toHaveProperty('auto_top_up')
  })
})

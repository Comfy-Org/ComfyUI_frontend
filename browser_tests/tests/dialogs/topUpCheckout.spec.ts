import { expect } from '@playwright/test'
import type { Page, Request, Route } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingCapabilitiesResponse,
  CreateTopupCheckoutResponse,
  CreateTopupQuoteRequest,
  ErrorResponse,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_front3643'
const PERSONAL_WORKSPACE_ID = workspace('personal', 'owner').id

function balance(
  fields: Partial<BillingBalanceResponse> = {}
): BillingBalanceResponse {
  return {
    amount_micros: 0,
    currency: 'usd',
    effective_balance_micros: 0,
    ...fields
  }
}

interface CheckoutRoutes {
  readonly checkoutRequests: Request[]
  readonly purchaseRequests: Request[]
}

async function mockCheckout(
  page: Page,
  answer: (route: Route) => Promise<void>
): Promise<CheckoutRoutes> {
  const checkoutRequests: Request[] = []
  const purchaseRequests: Request[] = []
  await page.route('**/api/billing/topup/checkout', (route) => {
    checkoutRequests.push(route.request())
    return answer(route)
  })
  await page.route('**/api/billing/topup', (route) => {
    purchaseRequests.push(route.request())
    return route.fulfill({ status: 500 })
  })
  await page
    .context()
    .route(CHECKOUT_URL, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'checkout' })
    )
  return { checkoutRequests, purchaseRequests }
}

const servesCheckoutUrl = (route: Route) =>
  route.fulfill({
    json: { checkout_url: CHECKOUT_URL } satisfies CreateTopupCheckoutResponse
  })

function refusesCheckout(
  status: number,
  body: ErrorResponse,
  headers: Record<string, string> = {}
) {
  return (route: Route) =>
    route.fulfill({
      status,
      json: body,
      headers: { 'Access-Control-Expose-Headers': 'Retry-After', ...headers }
    })
}

async function openTopUpDialog(page: Page) {
  const topUpDialog = new TopUpCreditsDialog(page)
  await page.getByTestId(TestIds.user.currentUserButton).click()
  await page
    .getByTestId(TestIds.user.currentUserPopover)
    .getByTestId('credits-menu-item')
    .hover()
  await page.getByTestId('add-credits-button').click()
  await expect(topUpDialog.heading).toBeVisible()
  return topUpDialog
}

async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function rebootWithBalance(
  comfyPage: ComfyPage,
  served: BillingBalanceResponse
) {
  await comfyPage.page.route('**/api/billing/balance', (route) =>
    route.fulfill({ json: served })
  )
  await comfyPage.goto()
  await comfyPage.waitForAppReady()
}

test.describe('Add credits checkout hand-off', { tag: '@ui' }, () => {
  test('hands the amount to checkout in a new tab and closes once the balance rises', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const routes = await mockCheckout(page, servesCheckoutUrl)
    const topUpDialog = await openTopUpDialog(page)
    await expect(topUpDialog.summary).toContainText('10,550 credits')

    const appUrl = page.url()
    const checkoutPage = page.context().waitForEvent('page')
    await topUpDialog.continueButton.click()

    await test.step('checkout is minted for the chosen amount', async () => {
      await expect.poll(() => routes.checkoutRequests.length).toBe(1)
      const checkoutBody = routes.checkoutRequests[0].postDataJSON()
      expect(checkoutBody).toMatchObject({ amount_cents: 5000 })
      expect(checkoutBody.return_url).toMatch(
        /^https:\/\/(test|staging)?billing\.comfy\.org\/return\/topup$/
      )
    })

    await test.step('the reserved tab lands on checkout_url', async () => {
      await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
      await expect(page).toHaveURL(appUrl)
      await expect(topUpDialog.openedHeading).toHaveText(
        'Checkout opened in a new tab'
      )
      await expect(topUpDialog.openedSummary).toContainText('$50.00')
      await expect(topUpDialog.reopenButton).toBeEnabled()
    })

    await test.step('the dialog closes when the balance goes up', async () => {
      await page.route('**/api/billing/balance', (route) =>
        route.fulfill({ json: balance({ amount_micros: 50_000_000 }) })
      )
      await returnToTab(page)
      await expect(topUpDialog.root).toBeHidden()
    })

    expect(routes.purchaseRequests).toHaveLength(0)
  })

  test('offers a checkout link when the browser blocks the new tab', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const routes = await mockCheckout(page, servesCheckoutUrl)
    const topUpDialog = await openTopUpDialog(page)
    await page.evaluate(() => {
      window.open = () => null
    })

    await topUpDialog.continueButton.click()

    await expect(topUpDialog.blockedHeading).toBeVisible()
    await expect(topUpDialog.openCheckoutLink).toHaveAttribute(
      'href',
      CHECKOUT_URL
    )
    const checkoutPage = page.context().waitForEvent('page')
    await topUpDialog.openCheckoutLink.click()
    await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
    await expect(topUpDialog.openedHeading).toBeVisible()
    expect(routes.checkoutRequests).toHaveLength(1)
    expect(routes.purchaseRequests).toHaveLength(0)
  })

  test('prefills the top-up that covers a negative balance', async ({
    comfyPage
  }) => {
    test.setTimeout(90_000)
    await rebootWithBalance(
      comfyPage,
      balance({
        amount_micros: -1_200,
        effective_balance_micros: -1_200,
        effective_balance_authoritative: true,
        suggested_topup_amount_cents: 8_000
      })
    )
    await mockCheckout(comfyPage.page, servesCheckoutUrl)

    const topUpDialog = await openTopUpDialog(comfyPage.page)

    await expect(topUpDialog.negativeBalance).toBeVisible()
    await expect(topUpDialog.amountInput).toHaveValue('80')
    await expect(topUpDialog.preset50).not.toBeChecked()
    await expect(topUpDialog.summary).toContainText('$80.00, paid at checkout')
  })

  for (const { refusal, capabilities } of [
    {
      refusal: 'not_allowed',
      capabilities: {
        ...createBillingCapabilities(PERSONAL_WORKSPACE_ID, {
          can_top_up: false
        }),
        revision: 2
      }
    },
    {
      refusal: 'purchases_paused',
      capabilities: {
        ...createBillingCapabilities(PERSONAL_WORKSPACE_ID, {
          can_top_up: false
        }),
        revision: 2,
        denied_reasons: { can_top_up: 'topup_purchases_paused' }
      }
    }
  ] satisfies {
    refusal: string
    capabilities: BillingCapabilitiesResponse
  }[]) {
    test(`stops offering checkout when can_top_up turns false mid-dialog (${refusal})`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      let revoked = false
      await page.route('**/api/billing/capabilities', (route) =>
        route.fulfill({
          json: revoked
            ? capabilities
            : createBillingCapabilities(PERSONAL_WORKSPACE_ID)
        })
      )
      const routes = await mockCheckout(page, servesCheckoutUrl)
      await page.route('**/api/billing/topup/quote', (route) => {
        const { amount_cents } = route
          .request()
          .postDataJSON() as CreateTopupQuoteRequest
        return route.fulfill({
          json: {
            amount_cents,
            credits: amount_cents * 2,
            expires_at: '2099-01-01T00:00:00Z'
          } satisfies TopupQuoteResponse,
          headers: revoked
            ? {
                'X-Capability-Revision': '2',
                'Access-Control-Expose-Headers': 'X-Capability-Revision'
              }
            : {}
        })
      })
      const topUpDialog = await openTopUpDialog(page)
      await expect(topUpDialog.continueButton).toBeEnabled()

      revoked = true
      const capabilityRead = page.waitForRequest('**/api/billing/capabilities')
      await topUpDialog.preset25.click()
      await capabilityRead

      await expect(topUpDialog.notice).toHaveAttribute('data-notice', refusal)
      await expect(topUpDialog.continueButton).toBeDisabled()
      expect(routes.checkoutRequests).toHaveLength(0)
    })
  }

  for (const { refusal, answer, body } of [
    {
      refusal: 'rate_limited',
      answer: refusesCheckout(
        429,
        { code: 'TOPUP_RATE_LIMITED', message: 'Too many top-ups' },
        { 'Retry-After': '2400' }
      ),
      body: 'Try again in 40 minutes, or message support.'
    },
    {
      refusal: 'purchases_paused',
      answer: refusesCheckout(403, {
        code: 'TOPUP_PURCHASES_PAUSED',
        message: 'Top-ups are paused'
      }),
      body: 'Try again later, or message support.'
    }
  ]) {
    test(`shows the ${refusal} refusal from checkout and keeps the dialog open`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const routes = await mockCheckout(page, answer)
      const topUpDialog = await openTopUpDialog(page)

      await topUpDialog.continueButton.click()

      await expect(topUpDialog.notice).toHaveAttribute('data-notice', refusal)
      await expect(topUpDialog.notice).toContainText(body)
      await expect(
        topUpDialog.notice.getByRole('link', { name: 'message support' })
      ).toBeVisible()
      await expect(topUpDialog.heading).toBeVisible()
      expect(routes.checkoutRequests).toHaveLength(1)
      expect(routes.purchaseRequests).toHaveLength(0)
    })
  }
})

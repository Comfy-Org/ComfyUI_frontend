import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_fe3450'
const FRESH_CHECKOUT_URL =
  'https://checkout.stripe.com/c/pay/cs_test_fe3450_fresh'

test.describe('Top-up through hosted checkout', () => {
  async function openTopUpDialog(page: Page) {
    const topUpDialog = new TopUpCreditsDialog(page)
    await page.getByTestId(TestIds.user.currentUserButton).click()
    await page
      .getByTestId(TestIds.user.currentUserPopover)
      .getByTestId('add-credits-button')
      .click()
    await expect(topUpDialog.heading).toBeVisible()
    return topUpDialog
  }

  test('hands the chosen amount off to checkout in a new tab', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const sessions = [CHECKOUT_URL, FRESH_CHECKOUT_URL]
    const checkoutRequests: Request[] = []
    await page.route('**/api/billing/topup/checkout', (route) => {
      checkoutRequests.push(route.request())
      return route.fulfill({
        json: { checkout_url: sessions[checkoutRequests.length - 1] }
      })
    })
    for (const url of sessions) {
      await page
        .context()
        .route(url, (route) =>
          route.fulfill({ contentType: 'text/html', body: 'checkout' })
        )
    }

    const topUpDialog = await openTopUpDialog(page)
    const chargeRequests: Request[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/api/billing/topup')) {
        chargeRequests.push(request)
      }
    })
    await topUpDialog.preset25.click()

    const appUrl = page.url()
    const checkoutRequest = page.waitForRequest('**/api/billing/topup/checkout')
    const checkoutPage = page.context().waitForEvent('page')
    await topUpDialog.continueToPaymentButton.click()

    const checkoutBody = (await checkoutRequest).postDataJSON()
    expect(checkoutBody).toMatchObject({ amount_cents: 2500 })
    expect(checkoutBody.return_url).toMatch(
      /^https:\/\/(test|staging)?billing\.comfy\.org\/return\/topup$/
    )
    await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
    await expect(page).toHaveURL(appUrl)
    await expect(topUpDialog.checkoutOpenedHeading).toBeVisible()
    await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    expect(chargeRequests).toHaveLength(0)

    const reopenedPage = page.context().waitForEvent('page')
    await topUpDialog.root
      .getByRole('button', { name: 'Reopen checkout' })
      .click()
    await expect(await reopenedPage).toHaveURL(FRESH_CHECKOUT_URL)
    await expect(topUpDialog.checkoutOpenedHeading).toBeVisible()
    expect(checkoutRequests).toHaveLength(2)
  })
})

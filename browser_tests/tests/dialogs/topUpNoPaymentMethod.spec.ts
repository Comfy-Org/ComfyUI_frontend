import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_fe1908'

/**
 * Regression coverage for the 1.51 QA finding: with no payment method saved,
 * a refused purchase surfaced the raw NO_PAYMENT_METHOD server error with no
 * path forward (FE-1908).
 *
 * Entered through the user popover like a real user: workspace-rail routing
 * needs the billing context loaded before the dialog opens, and the popover's
 * Add credits button only renders once it is.
 */
test.describe('Top-up without a saved payment method', () => {
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

  test('recovers a refused purchase through hosted checkout', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.route('**/api/billing/topup', (route) =>
      route.fulfill({
        status: 400,
        json: {
          code: 'NO_PAYMENT_METHOD',
          message:
            'No default payment method is selected. Please select one in the payment portal.'
        }
      })
    )
    await page.route('**/api/billing/topup/checkout', (route) =>
      route.fulfill({ json: { checkout_url: CHECKOUT_URL } })
    )
    await page
      .context()
      .route(CHECKOUT_URL, (route) =>
        route.fulfill({ contentType: 'text/html', body: 'checkout' })
      )

    const topUpDialog = await openTopUpDialog(page)
    await topUpDialog.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()
    await topUpDialog.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect(
      topUpDialog.root.getByText(/no card saved for one-click top-ups/)
    ).toBeVisible()
    await expect(comfyPage.toast.toastErrors).toHaveCount(0)

    const appUrl = page.url()
    const checkoutRequest = page.waitForRequest('**/api/billing/topup/checkout')
    const checkoutPage = page.context().waitForEvent('page')
    await topUpDialog.root
      .getByRole('button', { name: 'Continue to checkout' })
      .click()

    const checkoutBody = (await checkoutRequest).postDataJSON()
    expect(checkoutBody).toMatchObject({ amount_cents: 5000 })
    expect(checkoutBody.return_url).toMatch(
      /^https:\/\/(test|staging)?billing\.comfy\.org\/return\/topup$/
    )
    await expect(await checkoutPage).toHaveURL(CHECKOUT_URL)
    await expect(page).toHaveURL(appUrl)
    await expect(
      topUpDialog.root.getByRole('heading', {
        name: 'Checkout opened in a new tab'
      })
    ).toBeVisible()

    await topUpDialog.root
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await expect(topUpDialog.root).toBeHidden()
  })
})

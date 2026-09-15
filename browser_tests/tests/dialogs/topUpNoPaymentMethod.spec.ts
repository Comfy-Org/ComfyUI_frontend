import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type {
  PaymentPortalResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

/**
 * Regression coverage for the 1.51 QA finding: with no payment method saved,
 * the confirm step claimed "Your saved payment method is charged immediately"
 * and a refused purchase surfaced the raw NO_PAYMENT_METHOD server error with
 * no path forward (FE-1908).
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

  test('offers Manage billing and explains a refused purchase', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.route('**/api/billing/payment-methods', (route) =>
      route.fulfill({ json: [] satisfies SavedPaymentMethod[] })
    )
    await page.route('**/api/billing/payment-portal', (route) =>
      route.fulfill({
        json: {
          url: 'https://billing.example/portal'
        } satisfies PaymentPortalResponse
      })
    )
    await page
      .context()
      .route('https://billing.example/**', (route) =>
        route.fulfill({ contentType: 'text/html', body: 'portal stub' })
      )
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

    const topUpDialog = await openTopUpDialog(page)

    await topUpDialog.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()

    await expect(
      topUpDialog.root.getByText(
        "You'll be asked to add a payment method to complete this purchase."
      )
    ).toBeVisible()
    const [portalPage] = await Promise.all([
      page.context().waitForEvent('page'),
      topUpDialog.root.getByRole('button', { name: 'Manage billing' }).click()
    ])
    await expect(portalPage).toHaveURL('https://billing.example/portal')
    await portalPage.close()

    await topUpDialog.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect(
      page
        .locator('.p-toast-message.p-toast-message-error')
        .getByText(/Add one via Settings → Plan & Credits → Manage billing/)
    ).toBeVisible()
  })

  test('keeps the saved-card note when a payment method is on file', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.route('**/api/billing/payment-methods', (route) =>
      route.fulfill({
        json: [
          {
            id: 'pm-1',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            is_default: true
          }
        ] satisfies SavedPaymentMethod[]
      })
    )

    const topUpDialog = await openTopUpDialog(page)

    await topUpDialog.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()

    await expect(
      topUpDialog.root.getByText(
        'Your saved payment method is charged immediately.'
      )
    ).toBeVisible()
    await expect(
      topUpDialog.root.getByRole('button', { name: 'Manage billing' })
    ).toHaveCount(0)
  })
})

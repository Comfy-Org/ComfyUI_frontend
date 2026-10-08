import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

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

  test('explains a refused purchase', async ({ comfyPage }) => {
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

    const topUpDialog = await openTopUpDialog(page)

    await topUpDialog.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()

    await topUpDialog.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect(
      page
        .locator('.p-toast-message.p-toast-message-error')
        .getByText(/Add one via Settings → Plan & Credits → Manage billing/)
    ).toBeVisible()
  })
})

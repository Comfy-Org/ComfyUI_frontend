import { expect } from '@playwright/test'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  AUTO_TOP_UP_ACTIVATED,
  AUTO_TOP_UP_CHECKOUT,
  BALANCE_AFTER_FIFTY_DOLLARS
} from '@e2e/fixtures/data/autoTopUpAtCheckout'
import { mockAutoTopUpPurchase } from '@e2e/fixtures/utils/autoTopUpCheckoutMocks'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe('Add credits auto top-up at checkout', { tag: '@cloud' }, () => {
  test(
    'turns auto top-up on with the purchase when billing_auto_top_up_at_checkout_enabled is on',
    { tag: '@screenshot' },
    async ({ page }) => {
      const checkoutRequests = await mockAutoTopUpPurchase(page, {
        activation: AUTO_TOP_UP_ACTIVATED,
        atCheckout: true
      })
      const dialog = new TopUpCreditsDialog(page)
      await dialog.openFromTopupLink()

      await dialog.autoTopUpCheckbox.click()
      const consent = dialog.root.getByText(
        /^Top-ups are charged to your default card, visa ···· 4242/
      )
      await consent.scrollIntoViewIfNeeded()
      await expect(consent).toBeInViewport()
      await expectElementScreenshot(
        dialog.root.getByTestId('add-credits-dialog'),
        'add-credits-auto-top-up-consent.png'
      )
      await dialog.payAndReturn(
        AUTO_TOP_UP_CHECKOUT.checkout_url,
        BALANCE_AFTER_FIFTY_DOLLARS
      )

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
    }
  )

  test('offers no checkbox and sends no settings when billing_auto_top_up_at_checkout_enabled is off', async ({
    page
  }) => {
    const checkoutRequests = await mockAutoTopUpPurchase(page, {
      activation: AUTO_TOP_UP_ACTIVATED,
      atCheckout: false
    })
    const dialog = new TopUpCreditsDialog(page)
    await dialog.openFromTopupLink()

    await expect(
      dialog.root.getByTestId('add-credits-auto-top-up')
    ).toHaveCount(0)
    await dialog.continueButton.click()

    await expect.poll(() => checkoutRequests.length).toBe(1)
    expect(checkoutRequests[0].postDataJSON()).not.toHaveProperty('auto_top_up')
  })
})

import { expect } from '@playwright/test'

import type { operations } from '@/types/comfyRegistryTypes'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { localAuthFixture as test } from '@e2e/fixtures/localAuthFixture'
import { TestIds } from '@e2e/fixtures/selectors'

type CreditPurchaseResponse =
  operations['InitiateCreditPurchase']['responses']['201']['content']['application/json']

const MOCK_CHECKOUT_URL = 'https://checkout.stripe.com/mock'

/**
 * Regression coverage for a local/non-cloud dead-click: an unsubscribed user
 * on a local (non-Cloud) distribution must never see subscribe/upgrade UI in
 * the credits surfaces, and the "Add credits" purchase flow must keep working
 * no matter which of those surfaces was visited beforehand.
 *
 * Every other credits/billing e2e spec (creditsTile.spec.ts,
 * currentUserPopoverCredits.spec.ts, billingFacadeConsumers.spec.ts,
 * subscription.spec.ts) is tagged `@cloud` and only runs against the
 * Cloud-distribution build with an always-active paid subscription fixture,
 * so none of them ever exercise the OSS/local build (`isCloud === false`)
 * with a logged-in unsubscribed account — the exact combination that trips
 * this bug. This spec intentionally carries no `@cloud` tag so it runs in
 * the default (local) `chromium` project instead.
 */
test.describe('Local credits surfaces hide subscribe UI (non-cloud)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (url) => {
        document.documentElement.dataset.openedUrl = String(url)
        return window
      }
    })
  })

  test('lets an unsubscribed user add credits from local billing surfaces', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const topUpDialog = new TopUpCreditsDialog(page)

    // 1. Profile popover: an unsubscribed local user gets "Add credits", never
    //    "Upgrade to add credits" — subscribing is a Cloud-only concept.
    await page.getByTestId(TestIds.user.currentUserButton).click()
    let popover = page.getByTestId(TestIds.user.currentUserPopover)
    await expect(popover).toBeVisible()
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
    await expect(
      popover.getByTestId('upgrade-to-add-credits-button')
    ).toHaveCount(0)

    // Clicking it must open the purchase dialog, not silently no-op.
    await popover.getByTestId('add-credits-button').click()
    await expect(topUpDialog.heading).toBeVisible()
    await topUpDialog.close()

    await page.getByTestId(TestIds.user.currentUserButton).click()
    popover = page.getByTestId(TestIds.user.currentUserPopover)
    await popover.getByTestId('plans-credits-menu-item').click()

    const settingsDialog = comfyPage.settingDialog
    await settingsDialog.waitForVisible()
    const planCreditsContent = settingsDialog.contentArea
    await expect(
      planCreditsContent.getByRole('button', { name: 'Credits', exact: true })
    ).toBeVisible()
    await expect(
      planCreditsContent.getByRole('button', { name: 'Activity', exact: true })
    ).toBeVisible()
    await expect(
      planCreditsContent.getByText('Upgrade to add credits')
    ).toHaveCount(0)
    await expect(
      planCreditsContent.getByRole('button', { name: 'Manage subscription' })
    ).toHaveCount(0)
    await expect(
      planCreditsContent.getByRole('button', { name: 'Billing & invoices' })
    ).toHaveCount(0)

    const settingsAddCredits = planCreditsContent.getByRole('button', {
      name: 'Add credits'
    })
    await expect(settingsAddCredits).toBeVisible()
    await settingsAddCredits.click()
    await expect(topUpDialog.heading).toBeVisible()

    await page.route('**/customers/credit', (route) =>
      route.fulfill({
        status: 201,
        json: {
          checkout_url: MOCK_CHECKOUT_URL
        } satisfies CreditPurchaseResponse
      })
    )
    const [purchaseRequest] = await Promise.all([
      page.waitForRequest('**/customers/credit'),
      topUpDialog.root
        .getByRole('button', { name: 'Continue to payment' })
        .click()
    ])
    expect(purchaseRequest.postDataJSON()).toEqual({
      amount_micros: 50_000_000,
      currency: 'usd'
    })
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe(MOCK_CHECKOUT_URL)
    await expect(topUpDialog.root).toBeHidden()

    await settingsDialog.close()

    await page.getByTestId(TestIds.user.currentUserButton).click()
    popover = page.getByTestId(TestIds.user.currentUserPopover)
    await expect(
      popover.getByTestId('upgrade-to-add-credits-button')
    ).toHaveCount(0)
    await popover.getByTestId('add-credits-button').click()
    await expect(topUpDialog.heading).toBeVisible()
  })
})

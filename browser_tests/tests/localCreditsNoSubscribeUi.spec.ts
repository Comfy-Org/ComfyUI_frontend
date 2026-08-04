import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { localAuthFixture as test } from '@e2e/fixtures/localAuthFixture'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Regression coverage for a local/non-cloud dead-click: a logged-in Free-tier
 * user on a local (non-Cloud) distribution must never see subscribe/upgrade
 * UI in the credits surfaces, and the "Add credits" purchase flow must keep
 * working no matter which of those surfaces was visited beforehand.
 *
 * Every other credits/billing e2e spec (creditsTile.spec.ts,
 * currentUserPopoverCredits.spec.ts, billingFacadeConsumers.spec.ts,
 * subscription.spec.ts) is tagged `@cloud` and only runs against the
 * Cloud-distribution build with an always-active paid subscription fixture,
 * so none of them ever exercise the OSS/local build (`isCloud === false`)
 * with a logged-in Free-tier account — the exact combination that trips
 * this bug. This spec intentionally carries no `@cloud` tag so it runs in
 * the default (local) `chromium` project instead.
 */
test.describe('Local credits surfaces hide subscribe UI (non-cloud)', () => {
  test('keeps "Add credits" working across the profile popover and Settings > Credits', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const topUpDialog = new TopUpCreditsDialog(page)

    // 1. Profile popover: a Free-tier local user gets "Add credits", never
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

    // 2. Settings > Credits, reached the same way the reported bug did: the
    //    popover's "Manage Plan" entry, not a generic keyboard shortcut. This
    //    must also hide the subscribe CTA and keep its own "Add credits"
    //    button working, not just render a dead replacement for it.
    await page.getByTestId(TestIds.user.currentUserButton).click()
    popover = page.getByTestId(TestIds.user.currentUserPopover)
    await popover.getByTestId('manage-plan-menu-item').click()

    const settingsDialog = comfyPage.settingDialog
    await settingsDialog.waitForVisible()
    const creditsContent = settingsDialog.contentArea
    await expect(
      creditsContent.getByText('Upgrade to add credits')
    ).toHaveCount(0)
    await expect(
      creditsContent.getByRole('button', { name: 'Manage subscription' })
    ).toHaveCount(0)
    await expect(
      creditsContent.getByRole('button', { name: 'Billing & invoices' })
    ).toHaveCount(0)
    await expect(
      creditsContent.getByRole('button', { name: 'Invoice history' })
    ).toBeVisible()

    const settingsAddCredits = creditsContent.getByRole('button', {
      name: 'Add credits'
    })
    await expect(settingsAddCredits).toBeVisible()
    await settingsAddCredits.click()
    await expect(topUpDialog.heading).toBeVisible()
    await topUpDialog.close()

    await settingsDialog.close()

    // 3. Reopening the popover afterward must still work — regression check
    //    for the stuck-trigger bug, where visiting Settings > Credits left
    //    the popover's top-up button permanently dead.
    await page.getByTestId(TestIds.user.currentUserButton).click()
    popover = page.getByTestId(TestIds.user.currentUserPopover)
    await expect(
      popover.getByTestId('upgrade-to-add-credits-button')
    ).toHaveCount(0)
    await popover.getByTestId('add-credits-button').click()
    await expect(topUpDialog.heading).toBeVisible()
  })
})

test.describe('Local paid invoice actions (non-cloud)', () => {
  test.use({ hasPaidSubscription: true })
  let content: Locator

  test.beforeEach(async ({ comfyPage }) => {
    const page = comfyPage.page
    await page.evaluate(() => {
      window.open = (url) => {
        document.documentElement.dataset.openedUrl = String(url)
        return window
      }
    })
    await page.getByTestId(TestIds.user.currentUserButton).click()
    await page
      .getByTestId(TestIds.user.currentUserPopover)
      .getByTestId('manage-plan-menu-item')
      .click()
    await comfyPage.settingDialog.waitForVisible()
    content = comfyPage.settingDialog.contentArea
  })

  test('keeps Manage billing and Invoice history connected to the portal', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const manageRequest = page.waitForRequest('**/customers/billing')
    await content.getByRole('button', { name: 'Manage billing' }).click()
    expect((await manageRequest).method()).toBe('POST')
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')

    const invoiceRequest = page.waitForRequest('**/customers/billing')
    await content.getByRole('button', { name: 'Invoice history' }).click()
    expect((await invoiceRequest).method()).toBe('POST')
  })
})

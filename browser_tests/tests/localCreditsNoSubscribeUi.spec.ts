import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  createSubscriptionHelper,
  withFreeTier
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { SubscriptionHelper } from '@e2e/fixtures/helpers/SubscriptionHelper'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Regression coverage for a local/non-cloud dead-click: a logged-in Free-tier
 * user on a local (non-Cloud) distribution must never see subscribe/upgrade
 * UI in the credits surfaces, and the "Add credits" purchase flow must keep
 * working no matter what happened in Settings > Credits beforehand.
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
const test2 = test.extend<{ subscriptionHelper: SubscriptionHelper }>({
  subscriptionHelper: [
    async ({ comfyPage }, use) => {
      await new CloudAuthHelper(comfyPage.page).mockAuth()
      const helper = createSubscriptionHelper(comfyPage.page, withFreeTier())
      await helper.mock()
      await comfyPage.page.reload()
      await expect(
        comfyPage.page.getByTestId(TestIds.user.currentUserButton)
      ).toBeVisible()
      await use(helper)
      await helper.clearMocks()
    },
    { auto: true }
  ]
})

test2.describe('Local credits surfaces hide subscribe UI (non-cloud)', () => {
  test2(
    'keeps "Add credits" working after visiting Settings > Credits',
    async ({ comfyPage }) => {
      const page = comfyPage.page

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
      const topUpDialog = new TopUpCreditsDialog(page)
      await expect(topUpDialog.heading).toBeVisible()
      await topUpDialog.close()

      // 2. Settings > Credits: visiting this page (which mirrors the bug
      //    report's repro steps) must not surface the subscribe/upgrade
      //    button either, even once the free-tier status has loaded.
      await page.keyboard.press('Control+,')
      const settingsDialog = page.getByTestId(TestIds.dialogs.settings)
      await expect(settingsDialog).toBeVisible()
      await settingsDialog
        .locator('nav')
        .getByRole('button', { name: 'Credits', exact: true })
        .click()
      const creditsContent = settingsDialog.getByRole('main')
      await expect(creditsContent).toContainText('Credits')
      await expect(
        creditsContent.getByText('Upgrade to add credits')
      ).toHaveCount(0)

      await page.keyboard.press('Escape')
      await expect(settingsDialog).toBeHidden()

      // 3. Reopening the popover and clicking "Add credits" again must still
      //    open the purchase dialog — regression check for the stuck-trigger
      //    bug, where the free-tier status fetched by Settings > Credits
      //    left the popover's top-up button permanently dead.
      await page.getByTestId(TestIds.user.currentUserButton).click()
      popover = page.getByTestId(TestIds.user.currentUserPopover)
      await expect(popover).toBeVisible()
      await expect(
        popover.getByTestId('upgrade-to-add-credits-button')
      ).toHaveCount(0)
      await popover.getByTestId('add-credits-button').click()
      await expect(topUpDialog.heading).toBeVisible()
    }
  )
})

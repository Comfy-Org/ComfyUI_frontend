import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  createBalance,
  createSubscriptionStatus
} from '@e2e/fixtures/data/subscriptionFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Local (non-Cloud) credits gating.
 *
 * Every other billing/credits spec is tagged `@cloud`, so the suite only ever
 * runs against the `DISTRIBUTION=cloud` bundle. This one runs in the `chromium`
 * project (localhost bundle, `isCloud === false`) as a signed-in desktop user
 * with no Comfy Cloud subscription.
 *
 * Nothing fetches subscription status on a local boot until Settings ▸ Credits
 * mounts the credits tile. That first fetch flips `isFreeTier` to true, which
 * used to swap in an "Upgrade to add credits" CTA and reroute every later
 * top-up into `showSubscriptionRequiredDialog`. Both are cloud-only, so off
 * cloud they no-op silently and the purchase flow dies until app restart.
 */
const freeTierStatus = createSubscriptionStatus({
  is_active: true,
  subscription_id: 'sub_local_free',
  subscription_tier: 'FREE',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-01-01T00:00:00Z',
  end_date: null,
  has_fund: true
})

const balance = createBalance({
  amount_micros: 5000,
  effective_balance_micros: 5000,
  prepaid_balance_micros: 5000,
  currency: 'usd'
})

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.route('**/customers/cloud-subscription-status', (route) =>
      route.fulfill({ json: freeTierStatus })
    )
    await page.route('**/customers/balance', (route) =>
      route.fulfill({ json: balance })
    )
    await use(page)
  }
})

test.describe(
  'Credits on a local build without a Cloud subscription',
  { tag: ['@oss', '@auth'] },
  () => {
    test('never offers a subscribe/upgrade path and keeps top-up working after Settings ▸ Credits', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const topUpDialog = new TopUpCreditsDialog(page)
      const userButton = page.getByTestId(TestIds.user.currentUserButton)

      await expect(userButton).toBeVisible()
      await comfyPage.toast.closeToasts()

      await userButton.click()
      await expect(
        page.getByTestId(TestIds.user.currentUserPopover)
      ).toBeVisible()
      await expect(
        page.getByTestId('upgrade-to-add-credits-button')
      ).toBeHidden()
      await expect(page.getByTestId('plans-pricing-menu-item')).toBeHidden()

      await page.getByTestId('add-credits-button').click()
      await topUpDialog.waitForVisible()
      await topUpDialog.close()

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Credits').click()
      await expect(
        comfyPage.settingDialog.contentArea.getByText('Total credits')
      ).toBeVisible()
      await expect(
        page.getByTestId('upgrade-to-add-credits-button')
      ).toBeHidden()
      await expect(
        comfyPage.settingDialog.contentArea.getByText('Upgrade to add credits')
      ).toBeHidden()
      await comfyPage.settingDialog.close()

      await userButton.click()
      await page.getByTestId('add-credits-button').click()
      await topUpDialog.waitForVisible()
    })
  }
)

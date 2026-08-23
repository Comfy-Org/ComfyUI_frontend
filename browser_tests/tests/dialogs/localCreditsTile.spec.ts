import { expect } from '@playwright/test'

import { localAuthFixture as test } from '@e2e/fixtures/localAuthFixture'
import {
  createBalance,
  createSubscriptionStatus
} from '@e2e/fixtures/data/subscriptionFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Local credits tile', () => {
  test('hides the Cloud monthly progress bar for an active subscription', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await page.route('**/api/billing/status', (route) =>
      route.fulfill({
        json: createSubscriptionStatus({
          is_active: true,
          subscription_tier: 'PRO',
          subscription_duration: 'MONTHLY',
          renewal_date: '2099-02-20T12:00:00Z',
          has_funds: true
        })
      })
    )
    await page.route('**/customers/balance', (route) =>
      route.fulfill({
        json: createBalance({
          amount_micros: 4_000,
          effective_balance_micros: 4_000,
          cloud_credit_balance_micros: 3_500,
          prepaid_balance_micros: 500
        })
      })
    )

    await page.getByTestId(TestIds.user.currentUserButton).click()
    await page
      .getByTestId(TestIds.user.currentUserPopover)
      .getByTestId('manage-plan-menu-item')
      .click()

    const settingsDialog = comfyPage.settingDialog
    await settingsDialog.waitForVisible()
    const creditsContent = settingsDialog.contentArea
    await creditsContent
      .getByRole('button', { name: 'Refresh credits' })
      .click()

    await expect(creditsContent.getByText('Total credits')).toBeVisible()
    await expect(creditsContent.getByText('Additional credits')).toBeVisible()
    await expect(
      creditsContent.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    await expect(
      creditsContent.getByText('Monthly', { exact: true })
    ).toHaveCount(0)
    await expect(creditsContent.getByRole('progressbar')).toHaveCount(0)
  })
})

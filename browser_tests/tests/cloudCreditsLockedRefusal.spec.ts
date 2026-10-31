import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  LEGACY_PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const FREE_ACCOUNT_WITH_CREDITS = {
  ...LEGACY_PERSONAL_BILLING_STATUS,
  is_active: true,
  subscription_status: undefined
}

async function runAndGetRefused(page: Page, creditsLocked: boolean) {
  await page.route('**/api/prompt', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          ...jsonRoute({
            node_errors: {},
            error: {
              type: 'CLOUD_SUBSCRIPTION_REQUIRED',
              message: 'A cloud subscription is required to queue workflows.',
              credits_locked: creditsLocked
            }
          }),
          status: 402
        })
      : route.fallback()
  )

  await page.goto(APP_URL)
  await waitForCloudApp(page)

  await page.getByTestId(TestIds.topbar.queueButton).click()
}

test.describe('Run refused for locked credits', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page }) => {
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      workspace('personal', 'owner'),
      FREE_ACCOUNT_WITH_CREDITS,
      { can_run_workflows: true }
    )
    await page.route('**/api/features', (route) =>
      route.fulfill(jsonRoute({ subscription_required: true }))
    )
    await page.route('**/customers/balance', (route) =>
      route.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
    )
  })

  test('says why bought credits did not unlock the run', async ({ page }) => {
    await runAndGetRefused(page, true)

    const notice = page.getByTestId('credits-locked-notice')
    await expect(notice).toBeVisible({ timeout: 30_000 })
    await expect(notice).toHaveText(
      "Buying credits doesn't start a Cloud plan. Subscribe to run workflows on Cloud."
    )
    await expectRegionScreenshot(
      page,
      [
        page
          .getByRole('dialog')
          .getByRole('heading', { name: 'Choose a Plan' }),
        notice
      ],
      'credits-locked-subscribe-dialog.png'
    )
  })

  test('stays out of the dialog for an account with no credits', async ({
    page
  }) => {
    await runAndGetRefused(page, false)

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('credits-locked-notice')).toHaveCount(0)
  })
})

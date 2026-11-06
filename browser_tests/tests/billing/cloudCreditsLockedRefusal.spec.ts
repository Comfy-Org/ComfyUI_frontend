import type { Page } from '@playwright/test'

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
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'
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

  for (const creditsLocked of [true, false]) {
    test(`hands a refused run to the platform Plans page (credits_locked: ${creditsLocked})`, async ({
      page
    }) => {
      await expectPlatformPlansOpened(page, () =>
        runAndGetRefused(page, creditsLocked)
      )
    })
  }
})

async function arrangeEndedPlan(page: Page, hasFunds: boolean) {
  await new CloudWorkspaceMockHelper(page).setup(
    DEFAULT_TEAM_MEMBERS,
    workspace('personal', 'owner'),
    {
      ...LEGACY_PERSONAL_BILLING_STATUS,
      subscription_state: 'ended',
      has_funds: hasFunds
    }
  )
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute({ subscription_required: true }))
  )
  // cloud/1.59's legacy billing reads the balance during init; unmocked, init
  // fails and the Subscribe to Run button never renders.
  await page.route('**/customers/balance', (route) =>
    route.fulfill(
      jsonRoute({ amount_micros: hasFunds ? 5_000_000 : 0, currency: 'usd' })
    )
  )
}

async function clickSubscribeToRun(page: Page) {
  await page.goto(APP_URL)
  await waitForCloudApp(page)
  await page.getByTestId(TestIds.topbar.subscribeToRunButton).click()
}

test.describe('Subscribe to Run for an ended plan', { tag: '@cloud' }, () => {
  for (const hasFunds of [true, false]) {
    test(`opens the platform Plans page (has_funds: ${hasFunds})`, async ({
      page
    }) => {
      await arrangeEndedPlan(page, hasFunds)

      await expectPlatformPlansOpened(page, () => clickSubscribeToRun(page))
    })
  }
})

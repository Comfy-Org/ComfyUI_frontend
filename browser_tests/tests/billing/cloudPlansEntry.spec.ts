import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  ENDED_STANDARD_BILLING_STATUS,
  PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const PERSONAL = workspace('personal', 'owner')
const FREE_STATUS = {
  ...PERSONAL_BILLING_STATUS,
  is_active: true,
  has_funds: false,
  subscription_status: undefined,
  subscription_state: 'never_subscribed'
} as const

async function arrangePlansEntry(page: Page, ended = false) {
  const billing = new CloudWorkspaceMockHelper(page)
  await billing.setup(
    DEFAULT_TEAM_MEMBERS,
    PERSONAL,
    ended ? ENDED_STANDARD_BILLING_STATUS : FREE_STATUS,
    { can_run_workflows: !ended }
  )
  await page.route('**/api/features', (route) =>
    route.fulfill(
      jsonRoute({
        subscription_required: true,
        billing_new_ux_enabled: true,
        unified_billing_settings: true,
        free_tier_balance: { remaining: 5, allowance: 5, used: 0 }
      })
    )
  )
  return billing
}

test.describe('Cloud Plans entry points', { tag: '@cloud' }, () => {
  test(
    'opens Platform Plans from the free-tier Upgrade button',
    { tag: '@smoke' },
    async ({ page }) => {
      await arrangePlansEntry(page)
      await page.goto(APP_URL)
      await waitForCloudApp(page)

      const plans = await expectPlatformPlansOpened(page, () =>
        page.getByRole('button', { name: 'Upgrade', exact: true }).click()
      )
      expect(new URL(plans.url()).searchParams.get('workspace')).toBe(
        PERSONAL.id
      )
    }
  )

  for (const entry of ['Subscribe', 'Choose a plan'] as const) {
    test(`opens Platform Plans from Billing’s ${entry} link`, async ({
      page
    }) => {
      const billing = await arrangePlansEntry(page, entry === 'Choose a plan')
      const content = await billing.openPlanAndCreditsSettings('Billing')

      const plans = await expectPlatformPlansOpened(page, () =>
        content.getByRole('link', { name: entry, exact: true }).last().click()
      )
      expect(new URL(plans.url()).searchParams.get('workspace')).toBe(
        PERSONAL.id
      )
    })
  }

  test(
    'offers a direct Plans link when the Upgrade pop-up is blocked',
    { tag: '@smoke' },
    async ({ page }) => {
      await arrangePlansEntry(page)
      await page.addInitScript(() => {
        window.open = () => null
      })
      await page.goto(APP_URL)
      await waitForCloudApp(page)
      await page.getByRole('button', { name: 'Upgrade', exact: true }).click()

      const dialog = page.getByTestId('platform-plans-link-dialog')
      await expect(dialog.getByText("Plans page didn't open")).toBeVisible()
      const link = dialog.getByRole('link', { name: 'Open Plans page' })
      const plans = await expectPlatformPlansOpened(page, () => link.click())
      expect(new URL(plans.url()).searchParams.get('workspace')).toBe(
        PERSONAL.id
      )
      await expect(
        page.getByRole('heading', { name: 'Choose a Plan' })
      ).toBeHidden()
    }
  )
})

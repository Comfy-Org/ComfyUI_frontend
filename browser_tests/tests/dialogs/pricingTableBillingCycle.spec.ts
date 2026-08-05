import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_BILLING_PLANS,
  DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE
} from '@e2e/fixtures/data/cloudWorkspace'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  consolidated_billing_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true,
  'Comfy.RightSidePanel.ShowErrorsTab': false
}

async function setupCloudPricing(page: Page) {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
  })
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  })
  await page.route('**/api/queue', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  })
  await mockWorkspace(page, workspace('personal', 'owner'), [])
  await bootCloud(page)
}

test.describe(
  'Pricing table billing cycle',
  { tag: ['@cloud', '@mobile'] },
  () => {
    test('BILL-P01 switches Creator pricing from monthly to yearly', async ({
      billingApi,
      page
    }) => {
      test.slow()
      const annualPlan = DEFAULT_BILLING_PLANS.plans.find(
        ({ slug }) => slug === 'creator-annual'
      )
      if (!annualPlan) throw new Error('Missing creator-annual plan')

      await billingApi.setup({
        previewResponse: {
          ...DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
          cost_today_cents: annualPlan.price_cents,
          cost_next_period_cents: annualPlan.price_cents,
          credits_today_cents: annualPlan.credits_cents,
          credits_next_period_cents: annualPlan.credits_cents,
          new_plan: annualPlan
        }
      })
      await setupCloudPricing(page)
      await page.goto(APP_URL)
      await waitForCloudApp(page)
      await page.getByTestId('current-user-button').click()
      const userPopover = page.getByTestId('current-user-popover')
      await expect(userPopover).toBeVisible()
      await userPopover.getByTestId('plans-pricing-menu-item').click()

      const dialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Choose a Plan' })
      })
      await expect(dialog).toBeVisible({ timeout: 45_000 })

      await dialog.getByRole('button', { name: 'Monthly', exact: true }).click()
      const monthlyPlan = dialog.getByRole('button', {
        name: 'Subscribe to Creator',
        exact: true
      })
      await expect(monthlyPlan).toBeVisible()
      expect(await monthlyPlan.locator('../..').innerText()).toContain('$35')

      const yearlyToggle = dialog.getByRole('button', {
        name: 'Yearly Save 20%',
        exact: true
      })
      await expect(
        yearlyToggle.getByText('Save 20%', { exact: true })
      ).toBeVisible()
      await yearlyToggle.click()

      const yearlyPlan = dialog.getByRole('button', {
        name: 'Subscribe to Creator Yearly',
        exact: true
      })
      await expect(yearlyPlan).toBeVisible()
      const yearlyPlanText = await yearlyPlan.locator('../..').innerText()
      expect(yearlyPlanText).toContain('$28')
      expect(yearlyPlanText).toContain('$336 Billed yearly')
      await yearlyPlan.click()

      await expect(
        page.getByRole('heading', { name: 'Confirm your payment' })
      ).toBeVisible()
      expect(billingApi.requests.previewSubscribe).toEqual([
        expect.objectContaining({ plan_slug: 'creator-annual' })
      ])
    })
  }
)

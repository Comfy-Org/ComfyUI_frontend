import { expect } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import { cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  DEFAULT_TEAM_MEMBERS,
  EMPTY_BILLING_BALANCE,
  TEAM_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

interface BillingScenario {
  settings: CloudWorkspaceMockHelper
  status: BillingStatusResponse
  balance: BillingBalanceResponse
}

const test = cloudAppFixture.extend<{ billing: BillingScenario }>({
  billing: async ({ page }, use) => {
    const settings = new CloudWorkspaceMockHelper(page)
    const billing: BillingScenario = {
      settings,
      status: TEAM_BILLING_STATUS,
      balance: EMPTY_BILLING_BALANCE
    }
    await settings.setup(DEFAULT_TEAM_MEMBERS, TEAM_WORKSPACE)
    await page.route('**/api/billing/capabilities', (route) =>
      route.fulfill(
        jsonRoute({
          ...createWorkspaceBillingCapabilities(TEAM_WORKSPACE),
          billing_notice_audience: 'team'
        })
      )
    )
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          billing_new_ux_enabled: true,
          billing_control_enabled: true,
          unified_billing_settings: true
        })
      )
    )
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(billing.status))
    )
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill(jsonRoute(billing.balance))
    )
    await use(billing)
  }
})

test.describe('Cloud Billing refresh', { tag: '@cloud' }, () => {
  test('FRONT-4141: replaces an ended Pro plan with Team on return and after reload', async ({
    billing,
    page
  }) => {
    billing.status = {
      ...TEAM_BILLING_STATUS,
      is_active: false,
      billing_status: 'inactive',
      subscription_status: 'ended',
      plan_slug: 'pro-monthly',
      ended_at: '2026-11-01T00:00:00Z'
    }
    const content = await billing.settings.openPlanAndCreditsSettings('Billing')
    const planTitle = content
      .getByTestId('billing-plan-row')
      .getByRole('heading')
    const plan = content.getByTestId('billing-plan-line')
    const credits = content.getByTestId('billing-credits-available')
    await expect(planTitle).toHaveText('Pro')
    await expect(plan).toContainText(/ended november 1/i)
    await expect(credits).toHaveText('0')

    billing.status = TEAM_BILLING_STATUS
    billing.balance = {
      ...EMPTY_BILLING_BALANCE,
      amount_micros: 1000,
      effective_balance_micros: 1000
    }
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    await expect(planTitle).toHaveText('Team')
    await expect(plan).toContainText(/billed monthly/i)
    await expect(credits).toHaveText('2,110')

    await page.reload()
    await page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    const settings = page.getByTestId('settings-dialog')
    await settings
      .locator('nav')
      .getByRole('button', { name: 'Billing', exact: true })
      .click()
    await expect(planTitle).toHaveText('Team')
    await expect(plan).toContainText(/billed monthly/i)
    await expect(credits).toHaveText('2,110')
  })

  test('shows the ending notice when Billing reopens after cancellation', async ({
    billing,
    page
  }) => {
    const content = await billing.settings.openPlanAndCreditsSettings('Billing')
    await expect(content.getByTestId('billing-plan-line')).toContainText(
      /billed monthly/i
    )

    const settings = page.getByTestId('settings-dialog')
    await settings.getByRole('button', { name: 'Close dialog' }).click()
    billing.status = {
      ...TEAM_BILLING_STATUS,
      subscription_status: 'canceled',
      cancel_at: '2099-02-20T00:00:00Z'
    }
    await page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    await settings
      .locator('nav')
      .getByRole('button', { name: 'Billing', exact: true })
      .click()

    await expect(content.getByText(/Your Team plan ends on/)).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Resume plan' }).first()
    ).toBeVisible()
  })
})

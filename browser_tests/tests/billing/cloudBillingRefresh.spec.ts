import { expect } from '@playwright/test'
import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  DEFAULT_TEAM_MEMBERS,
  EMPTY_BILLING_BALANCE,
  TEAM_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test(
  'updates the open Billing tab when the user returns after a plan change elsewhere',
  {
    tag: '@cloud'
  },
  async ({ page }) => {
    const billing = new CloudWorkspaceMockHelper(page)
    let status: BillingStatusResponse = {
      ...TEAM_BILLING_STATUS,
      is_active: false,
      billing_status: 'inactive',
      subscription_status: 'ended',
      ended_at: '2026-11-01T00:00:00Z'
    }
    await billing.setup(DEFAULT_TEAM_MEMBERS, TEAM_WORKSPACE, status)
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
      route.fulfill(jsonRoute(status))
    )

    let balance = EMPTY_BILLING_BALANCE
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill(jsonRoute(balance))
    )

    const content = await billing.openPlanAndCreditsSettings('Billing')
    const plan = content.getByTestId('billing-plan-line')
    const credits = content.getByTestId('billing-credits-available')
    await expect(plan).toContainText(/ended/i)
    await expect(credits).toHaveText('0')

    status = TEAM_BILLING_STATUS
    balance = {
      ...EMPTY_BILLING_BALANCE,
      amount_micros: 1000,
      effective_balance_micros: 1000
    }
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })

    await expect(plan).toContainText(/billed monthly/i)
    await expect(credits).toHaveText('2,110')

    await billing.openPlanAndCreditsSettings('Billing')
    await expect(plan).toContainText(/billed monthly/i)
    await expect(credits).toHaveText('2,110')

    const settings = page.getByTestId('settings-dialog')
    await settings.getByRole('button', { name: 'Close dialog' }).click()
    status = {
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
  }
)

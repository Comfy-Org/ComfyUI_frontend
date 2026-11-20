import { expect } from '@playwright/test'

import { cloudAppFixture } from '@e2e/fixtures/cloudAppFixture'
import { AUTO_TOP_UP_OFF } from '@e2e/fixtures/data/autoTopUpAtCheckout'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import {
  DEFAULT_TEAM_MEMBERS,
  EMPTY_BILLING_BALANCE,
  TEAM_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'

const test = cloudAppFixture.extend<{
  endedPlan: 'team-creator' | 'team-other-owner' | 'enterprise'
  billing: CloudWorkspaceMockHelper
}>({
  endedPlan: ['team-creator', { option: true }],
  billing: async ({ page, endedPlan }, use) => {
    const enterprise = endedPlan === 'enterprise'
    const otherOwner = endedPlan === 'team-other-owner'
    const billing = new CloudWorkspaceMockHelper(page)
    await billing.setup(DEFAULT_TEAM_MEMBERS, TEAM_WORKSPACE, {
      ...TEAM_BILLING_STATUS,
      billing_status: 'inactive',
      is_active: false,
      has_funds: false,
      subscription_status: 'ended',
      subscription_state: 'ended',
      ...(enterprise && {
        subscription_tier: 'ENTERPRISE',
        plan_slug: 'enterprise_monthly'
      })
    })
    await page.route('**/api/billing/capabilities', (route) =>
      route.fulfill(
        jsonRoute({
          ...createWorkspaceBillingCapabilities(TEAM_WORKSPACE, {
            can_open_plans: !enterprise && !otherOwner,
            can_top_up: true,
            can_view_auto_top_up: enterprise
          }),
          ...(enterprise && {
            auto_top_up_enabled: true,
            auto_top_up_setup: {
              state: 'frozen',
              reason: 'default_payment_method_missing'
            }
          }),
          plan_kind: enterprise ? 'sales_managed' : 'self_serve',
          billing_notice_audience: enterprise ? 'none' : 'team',
          ...(otherOwner && {
            denied_reasons: { can_open_plans: 'not_original_owner' }
          })
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
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill(jsonRoute(EMPTY_BILLING_BALANCE))
    )
    await page.route('**/api/billing/payment-methods', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await page.route('**/api/billing/auto-reload', (route) =>
      route.fulfill(jsonRoute(AUTO_TOP_UP_OFF))
    )
    await use(billing)
  }
})

test.describe('Ended Cloud Billing plans', { tag: '@cloud' }, () => {
  test('lets the Team creator open Plans for their workspace', async ({
    billing,
    page
  }) => {
    const content = await billing.openPlanAndCreditsSettings('Billing')
    const plan = content.getByTestId('billing-plan-row')
    const plans = await expectPlatformPlansOpened(page, () =>
      plan.getByRole('link', { name: 'Choose a plan' }).click()
    )
    expect(new URL(plans.url()).searchParams.get('workspace')).toBe(
      TEAM_WORKSPACE.id
    )
  })

  test.describe('when Plans is only available to the original owner', () => {
    test.use({ endedPlan: 'team-other-owner' })

    test('tells another owner to ask the creator to resubscribe', async ({
      billing
    }) => {
      const content = await billing.openPlanAndCreditsSettings('Billing')
      await expect(
        content.getByText(
          "This workspace's plan has ended. Ask the workspace's creator to resubscribe."
        )
      ).toBeVisible()
      await expect(
        content.getByRole('link', { name: 'Choose a plan' })
      ).toHaveCount(0)
      await expect(
        content.getByText(
          'Resubscribe to run workflows and get shared credits again.'
        )
      ).toHaveCount(0)
    })
  })

  test.describe('for Enterprise', () => {
    test.use({ endedPlan: 'enterprise' })

    test('names the ended plan and directs renewal to Sales', async ({
      billing
    }) => {
      const content = await billing.openPlanAndCreditsSettings('Billing')
      const plan = content.getByTestId('billing-plan-row')
      await expect(
        plan.getByRole('heading', { name: 'Enterprise' })
      ).toBeVisible()
      await expect(plan).toContainText('This plan has ended.')
      await expect(
        content.getByText('Your Enterprise plan has ended')
      ).toBeVisible()
      await expect(
        content.getByText('Contact sales to start a new Enterprise plan.')
      ).toBeVisible()
      await expect(content.getByTestId('billing-credits-plan-note')).toHaveText(
        "Buying credits doesn't restart your Cloud plan. Contact sales to renew it."
      )
      await expect(content.getByText(/Your plan|Resubscribe/)).toHaveCount(0)
    })

    test('keeps Contact sales as the only primary action at zero credits', async ({
      billing
    }) => {
      const content = await billing.openPlanAndCreditsSettings('Billing')
      await expect(content.getByTestId('billing-credits-available')).toHaveText(
        '0'
      )
      const banner = content.getByRole('status').filter({
        hasText: 'Your Enterprise plan has ended'
      })
      const plan = content.getByTestId('billing-plan-row')
      await expect(
        banner.getByRole('button', { name: 'Contact sales' })
      ).toHaveAttribute('data-variant', 'inverted')
      await expect(
        plan.getByRole('link', { name: 'Contact sales' })
      ).toHaveAttribute('data-variant', 'inverted')
      await expect(
        content.getByRole('button', { name: 'Add credits' })
      ).toHaveAttribute('data-variant', 'secondary')
      await expect(
        content.getByRole('link', { name: 'Add payment method' })
      ).toHaveAttribute('data-variant', 'secondary')
      await expect(content.locator('[data-variant="inverted"]')).toHaveCount(2)
    })
  })
})

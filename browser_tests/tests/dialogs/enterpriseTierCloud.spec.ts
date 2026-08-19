import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  DEFAULT_TEAM_MEMBERS,
  TEAM_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const ACTIVE_ENTERPRISE_STATUS = {
  ...TEAM_BILLING_STATUS,
  subscription_tier: 'PRO',
  plan_slug: 'enterprise_monthly',
  renewal_date: '2027-04-25T00:00:00Z'
} satisfies BillingStatusResponse

const ENDED_ENTERPRISE_STATUS = {
  ...ACTIVE_ENTERPRISE_STATUS,
  billing_status: 'inactive',
  is_active: false,
  subscription_status: 'ended'
} satisfies BillingStatusResponse

const CANCELLED_ACTIVE_ENTERPRISE_STATUS = {
  ...ACTIVE_ENTERPRISE_STATUS,
  cancel_at: '2027-04-25T00:00:00Z',
  subscription_status: 'canceled'
} satisfies BillingStatusResponse

const UNKNOWN_TIER_STATUS = {
  ...TEAM_BILLING_STATUS,
  subscription_tier: 'FUTURE_TIER',
  plan_slug: 'future-tier-monthly'
}

async function setupWorkspace(
  page: Page,
  billingStatus: BillingStatusResponse
) {
  const workspace = new CloudWorkspaceMockHelper(page)
  await workspace.setup(DEFAULT_TEAM_MEMBERS, TEAM_WORKSPACE, billingStatus)
  return workspace
}

async function captureOpenedUrls(page: Page) {
  await page.addInitScript(() => {
    window.open = (url) => {
      document.documentElement.dataset.openedUrl = String(url)
      return window
    }
  })
}

async function expectNoSelfServicePlanActions(content: Locator) {
  await expect(
    content.getByRole('button', {
      name: /Change plan|Cancel|Subscribe|Reactivate/i
    })
  ).toHaveCount(0)
  await expect(
    content.getByText('View more details about plans & pricing')
  ).toHaveCount(0)
}

test.describe('Enterprise workspace billing', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('shows sales-managed plan details without catalog or lifecycle controls', async ({
    page
  }) => {
    const workspace = await setupWorkspace(page, ACTIVE_ENTERPRISE_STATUS)
    const content = await workspace.openWorkspaceSettings()

    await expect(
      content.getByRole('heading', { name: 'Enterprise' })
    ).toBeVisible()
    await expect(content.getByText('Renews on Apr 25, 2027')).toBeVisible()
    await expect(content.getByText('Your plan includes:')).toHaveCount(0)
    await expectNoSelfServicePlanActions(content)
  })

  test('keeps credit top-up and billing portal access available', async ({
    page
  }) => {
    await captureOpenedUrls(page)
    const workspace = await setupWorkspace(page, ACTIVE_ENTERPRISE_STATUS)
    const content = await workspace.openWorkspaceSettings()

    await content.getByRole('button', { name: 'Billing & invoices' }).click()
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')

    await content.getByRole('button', { name: 'Add credits' }).click()
    await new TopUpCreditsDialog(page).waitForVisible()
  })

  test('removes pricing entry points from the profile menu and deep links', async ({
    page
  }) => {
    await setupWorkspace(page, ACTIVE_ENTERPRISE_STATUS)
    await page.goto(`${APP_URL}/?pricing=team`)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    await expect(page).not.toHaveURL(/[?&]pricing=/)
    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.getByTestId('current-user-popover')
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
    await expect(popover.getByTestId('manage-plan-menu-item')).toBeVisible()
    await expect(popover.getByTestId('plans-pricing-menu-item')).toHaveCount(0)
  })

  test('keeps a cancelled active Enterprise workspace sales-managed', async ({
    page
  }) => {
    const workspace = await setupWorkspace(
      page,
      CANCELLED_ACTIVE_ENTERPRISE_STATUS
    )
    const content = await workspace.openWorkspaceSettings()

    await expect(
      content.getByRole('heading', { name: 'Enterprise' })
    ).toBeVisible()
    await expect(content.getByText('Canceled', { exact: true })).toBeVisible()
    await expectNoSelfServicePlanActions(content)

    await page
      .getByTestId('settings-dialog')
      .getByRole('button', { name: 'Close dialog' })
      .click()
    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.getByTestId('current-user-popover')
    await expect(
      popover.getByRole('button', { name: 'Resubscribe' })
    ).toHaveCount(0)
    await expect(popover.getByTestId('plans-pricing-menu-item')).toHaveCount(0)
  })

  test('keeps an ended Enterprise workspace out of self-service recovery', async ({
    page
  }) => {
    const workspace = await setupWorkspace(page, ENDED_ENTERPRISE_STATUS)
    const content = await workspace.openWorkspaceSettings()

    await expect(content.getByText('Your subscription has ended')).toBeVisible()
    await expect(
      content.getByRole('heading', { name: 'Enterprise' })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Billing & invoices' })
    ).toBeVisible()
    await expectNoSelfServicePlanActions(content)

    await expect(page.getByTestId('queue-button')).toBeVisible()
    await expect(page.getByTestId('subscribe-to-run-button')).toHaveCount(0)

    await page
      .getByTestId('settings-dialog')
      .getByRole('button', { name: 'Close dialog' })
      .click()
    await page.getByTestId('queue-button').click()
    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toHaveCount(0)
  })

  test('renders an unknown future tier without crashing', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const workspace = await setupWorkspace(page, TEAM_BILLING_STATUS)
    await page.route('**/api/billing/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(UNKNOWN_TIER_STATUS)
      })
    )
    const content = await workspace.openWorkspaceSettings()

    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    expect(pageErrors).toEqual([])
  })
})

test.describe('Non-Enterprise billing regression', { tag: '@cloud' }, () => {
  test('keeps self-service controls and catalog details for a Pro team', async ({
    page
  }) => {
    const workspace = await setupWorkspace(page, TEAM_BILLING_STATUS)
    const content = await workspace.openWorkspaceSettings()

    await expect(
      content.getByRole('heading', { name: 'Team', exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Change plan' })
    ).toBeVisible()
    await expect(
      content.getByText('Your plan includes everything in Pro, plus:', {
        exact: false
      })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Billing & invoices' })
    ).toBeVisible()

    await page
      .getByTestId('settings-dialog')
      .getByRole('button', { name: 'Close dialog' })
      .click()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(
      page
        .getByTestId('current-user-popover')
        .getByTestId('plans-pricing-menu-item')
    ).toBeVisible()
  })
})

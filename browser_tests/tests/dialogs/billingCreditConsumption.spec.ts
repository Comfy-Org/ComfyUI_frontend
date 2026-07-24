import type {
  BillingBalanceResponse,
  BillingPlansResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { operations } from '@/types/comfyRegistryTypes'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import {
  DEFAULT_BILLING_PLANS,
  DEFAULT_TEAM_MEMBERS,
  PERSONAL_BILLING_STATUS,
  TEAM_CREDIT_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

type CustomerBalanceResponse = NonNullable<
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']
>

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const PERSONAL_WORKSPACE = workspace('personal', 'owner')

function balance(
  monthlyCents: number,
  prepaidCents: number
): BillingBalanceResponse {
  const amountCents = monthlyCents + prepaidCents
  return {
    amount_micros: amountCents,
    currency: 'usd',
    effective_balance_micros: amountCents,
    cloud_credit_balance_micros: monthlyCents,
    prepaid_balance_micros: prepaidCents
  }
}

const TEAM_BALANCE_BEFORE_RUN = balance(50_000, 1_000)
const TEAM_BALANCE_AFTER_RUN = balance(49_000, 1_000)
const PERSONAL_BALANCE: CustomerBalanceResponse = {
  amount_micros: 100_000,
  currency: 'usd',
  effective_balance_micros: 100_000,
  cloud_credit_balance_micros: 90_000,
  prepaid_balance_micros: 10_000
}
const PERSONAL_STATUS: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-02-20T00:00:00Z',
  end_date: null
}

const ACTIVE_TEAM_PLANS = {
  ...DEFAULT_BILLING_PLANS,
  current_plan_slug: TEAM_CREDIT_BILLING_STATUS.plan_slug
} satisfies BillingPlansResponse

const ACTIVE_PERSONAL_PLANS = {
  ...DEFAULT_BILLING_PLANS,
  current_plan_slug: PERSONAL_BILLING_STATUS.plan_slug
} satisfies BillingPlansResponse

async function mockPersonalBilling(page: Page): Promise<void> {
  await page.route('**/customers/cloud-subscription-status', (route) =>
    route.fulfill({ json: PERSONAL_STATUS })
  )
  await page.route('**/customers/balance', (route) =>
    route.fulfill({ json: PERSONAL_BALANCE })
  )
}

async function openPlanAndCredits(
  page: Page,
  activeWorkspace: WorkspaceWithRole
): Promise<Locator> {
  const workspaceResponse = page.waitForResponse((response) => {
    const request = response.request()
    return (
      request.method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/api/workspaces')
    )
  })
  await page.goto(APP_URL)
  await workspaceResponse
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })

  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const settings = page.getByTestId('settings-dialog')
  await expect(settings).toBeVisible()
  await settings
    .locator('nav')
    .getByRole('button', { name: 'Workspace' })
    .click()

  const content = settings.getByRole('main')
  const planTab = content.getByRole('tab', { name: 'Plan & Credits' })
  await planTab.click()
  await expect(planTab).toHaveAttribute('data-state', 'active')
  await expect(
    content.getByRole('heading', { name: activeWorkspace.name })
  ).toBeVisible()
  return content
}

function creditsTile(content: Locator): Locator {
  return content
    .getByText('Total credits', { exact: true })
    .locator('xpath=../..')
}

test.describe('Billing credit consumption', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-11 refreshes the active Team pool from a mocked post-run balance', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: TEAM_CREDIT_BILLING_STATUS,
      balance: TEAM_BALANCE_BEFORE_RUN,
      plans: ACTIVE_TEAM_PLANS
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    await mockPersonalBilling(page)
    const content = await openPlanAndCredits(page, TEAM_WORKSPACE)
    const tile = creditsTile(content)

    await expect(tile.getByText('107,610', { exact: true })).toBeVisible()
    await expect(tile.getByText('105,500 left of 147,700')).toBeVisible()
    await expect(tile.getByText('211,000', { exact: true })).toHaveCount(0)

    billingApi.setBalance(TEAM_BALANCE_AFTER_RUN)
    await tile.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(
      content.getByRole('heading', { name: TEAM_WORKSPACE.name })
    ).toBeVisible()
    await expect(tile.getByText('105,500', { exact: true })).toBeVisible()
    await expect(tile.getByText('44,310 used')).toBeVisible()
    await expect(tile.getByText('103,390 left of 147,700')).toBeVisible()
    await expect(tile.getByText('2,110', { exact: true })).toBeVisible()
  })

  test('TB-15 shows monthly credits draining before additional credits', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      balance: balance(1_500, 500),
      plans: ACTIVE_PERSONAL_PLANS
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      PERSONAL_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page, PERSONAL_WORKSPACE)
    const tile = creditsTile(content)

    await expect(tile.getByText('4,220', { exact: true })).toBeVisible()
    await expect(tile.getByText('3,165 left of 4,200')).toBeVisible()
    await expect(tile.getByText('1,055', { exact: true })).toBeVisible()

    billingApi.setBalance(balance(1_000, 500))
    await tile.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(tile.getByText('3,165', { exact: true })).toBeVisible()
    await expect(tile.getByText('2,090 used')).toBeVisible()
    await expect(tile.getByText('2,110 left of 4,200')).toBeVisible()
    await expect(tile.getByText('1,055', { exact: true })).toBeVisible()
    await expect(tile.getByText('In use')).toHaveCount(0)

    billingApi.setBalance(balance(0, 400))
    await tile.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(tile.getByText('844', { exact: true })).toHaveCount(2)
    await expect(tile.getByText('0 left of 4,200')).toBeVisible()
    await expect(
      tile.getByText(/Monthly credits are used up\. Refills Feb \d{1,2}/)
    ).toBeVisible()
    await expect(tile.getByText('In use')).toBeVisible()
  })

  test('keeps the last known credits visible when a balance refresh fails', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      balance: balance(1_500, 500),
      plans: ACTIVE_PERSONAL_PLANS
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      PERSONAL_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page, PERSONAL_WORKSPACE)
    const tile = creditsTile(content)
    await expect(tile.getByText('4,220', { exact: true })).toBeVisible()

    billingApi.setBalance(balance(1_000, 500))
    billingApi.setQueryFailure('balance', {
      status: 503,
      message: 'Billing balance unavailable'
    })
    await tile.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(tile.getByText('4,220', { exact: true })).toBeVisible()
    await expect(
      page.locator('.p-toast-message-error').filter({
        hasText: 'Billing balance unavailable'
      })
    ).toBeVisible()

    billingApi.setQueryFailure('balance', null)
    await tile.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(tile.getByText('3,165', { exact: true })).toBeVisible()
  })

  test('shows a retry state instead of a false plan when billing status is unavailable', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: TEAM_CREDIT_BILLING_STATUS,
      balance: TEAM_BALANCE_BEFORE_RUN,
      plans: ACTIVE_TEAM_PLANS,
      queryFailures: {
        status: { status: 503, message: 'Billing status unavailable' }
      }
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page, TEAM_WORKSPACE)

    await expect(
      content.getByText("We couldn't load your plan details.")
    ).toBeVisible()
    await expect(content.getByText('$0', { exact: true })).toHaveCount(0)

    billingApi.setQueryFailure('status', null)
    await content.getByRole('button', { name: 'Try again' }).click()

    const tile = creditsTile(content)
    await expect(
      content.getByRole('heading', { name: 'Team', exact: true })
    ).toBeVisible()
    await expect(tile.getByText('107,610', { exact: true })).toBeVisible()
  })
})

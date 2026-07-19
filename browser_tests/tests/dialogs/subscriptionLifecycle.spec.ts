import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { BillingPlansResponse } from '@comfyorg/ingest-types'

import type { Member } from '@/platform/workspace/api/workspaceApi'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import {
  BILLING_RENEWAL_DATE,
  CANCELLED_TEAM_BILLING_STATUS,
  DEFAULT_BILLING_PLANS,
  DEFAULT_TEAM_MEMBERS,
  PENDING_BILLING_OPERATION,
  SUCCEEDED_BILLING_OPERATION,
  TEAM_BILLING_STATUS,
  TEAM_PRO_PLAN,
  TEAM_WORKSPACE,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const ACTIVE_TEAM_PLANS = {
  ...DEFAULT_BILLING_PLANS,
  current_plan_slug: TEAM_PRO_PLAN.slug,
  plans: [TEAM_PRO_PLAN, ...DEFAULT_BILLING_PLANS.plans]
} satisfies BillingPlansResponse

const CANCELLED_TEAM_PLANS = {
  ...DEFAULT_BILLING_PLANS,
  current_plan_slug: CANCELLED_TEAM_BILLING_STATUS.plan_slug
} satisfies BillingPlansResponse

function originalOwnerMembers(): Member[] {
  return DEFAULT_TEAM_MEMBERS.map((member) =>
    member.id === VIEWER.id
      ? {
          ...member,
          joined_at: '2024-01-01T00:00:00Z',
          is_original_owner: true
        }
      : { ...member, is_original_owner: false }
  )
}

function formattedEndDate(): string {
  return new Date(BILLING_RENEWAL_DATE).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

async function openPlanAndCredits(page: Page): Promise<Locator> {
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
    content.getByRole('heading', { name: TEAM_WORKSPACE.name })
  ).toBeVisible()
  return content
}

async function openCancelSubscriptionDialog(
  page: Page,
  content: Locator
): Promise<Locator> {
  await content.getByRole('button', { name: 'More Options' }).click()
  await page.getByRole('menuitem', { name: 'Cancel plan' }).click()

  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Cancel subscription' })
  })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('Workspace subscription lifecycle', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-26 original owner can cancel while access remains active through the end date', async ({
    billingApi,
    page
  }) => {
    const operationRequests: string[] = []
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname
      if (
        request.method() === 'GET' &&
        pathname.includes('/api/billing/ops/')
      ) {
        operationRequests.push(pathname)
      }
    })

    await billingApi.setup({
      status: TEAM_BILLING_STATUS,
      plans: ACTIVE_TEAM_PLANS,
      operationResponses: {
        'billing-op-cancel': [
          PENDING_BILLING_OPERATION,
          SUCCEEDED_BILLING_OPERATION
        ]
      }
    })
    await new CloudWorkspaceMockHelper(page).setup(
      originalOwnerMembers(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page)
    const cancelDialog = await openCancelSubscriptionDialog(page, content)

    await cancelDialog
      .getByRole('button', { name: 'Cancel subscription' })
      .click()

    await expect(cancelDialog).toBeHidden()
    expect(billingApi.requests.cancel).toHaveLength(1)
    expect(operationRequests).toHaveLength(2)
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        is_active: true,
        subscription_status: 'canceled',
        cancel_at: BILLING_RENEWAL_DATE
      })
    )
    await expect(
      content.getByText('Your subscription has been canceled', { exact: true })
    ).toBeVisible()
    await expect(
      content.getByText(`Ends on ${formattedEndDate()}`, { exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Reactivate plan' }).last()
    ).toBeVisible()
  })

  test('TB-26 non-original owner cannot cancel or reactivate the team plan', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: TEAM_BILLING_STATUS,
      plans: ACTIVE_TEAM_PLANS
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    let content = await openPlanAndCredits(page)

    await content.getByRole('button', { name: 'More Options' }).click()
    await expect(
      page.getByRole('menuitem', { name: 'Edit workspace details' })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Cancel plan' })
    ).toHaveCount(0)

    billingApi.state.status = structuredClone(CANCELLED_TEAM_BILLING_STATUS)
    billingApi.state.plans = structuredClone(CANCELLED_TEAM_PLANS)
    content = await openPlanAndCredits(page)

    await expect(
      content.getByText('Your subscription has been canceled', { exact: true })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Reactivate plan' })
    ).toHaveCount(0)
  })

  test('TB-27 reactivation restores the same workspace plan and removes ending UI', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: CANCELLED_TEAM_BILLING_STATUS,
      plans: CANCELLED_TEAM_PLANS
    })
    await new CloudWorkspaceMockHelper(page).setup(
      originalOwnerMembers(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page)
    const planSlug = billingApi.state.status.plan_slug
    const planHeading = content.getByRole('heading', {
      name: 'Team',
      exact: true
    })
    const planPrice = content.getByText('$630', { exact: true })

    await expect(planHeading).toBeVisible()
    await expect(planPrice).toBeVisible()

    await content
      .getByRole('button', { name: 'Reactivate plan' })
      .last()
      .click()

    await expect(page.locator('.p-toast-message-success')).toContainText(
      'Subscription reactivated successfully'
    )
    expect(billingApi.requests.resubscribe).toHaveLength(1)
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        is_active: true,
        subscription_status: 'active',
        plan_slug: planSlug
      })
    )
    expect(billingApi.state.status.cancel_at).toBeUndefined()
    await expect(
      content.getByText('Your subscription has been canceled', { exact: true })
    ).toHaveCount(0)
    await expect(content.getByText(/^Ends on /)).toHaveCount(0)
    await expect(
      content.getByRole('button', { name: 'Reactivate plan' })
    ).toHaveCount(0)
    await expect(
      content.getByRole('heading', { name: TEAM_WORKSPACE.name })
    ).toBeVisible()
    await expect(planHeading).toBeVisible()
    await expect(planPrice).toBeVisible()
  })

  test('TB-27 failed reactivation keeps the canceled plan recoverable', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: CANCELLED_TEAM_BILLING_STATUS,
      plans: CANCELLED_TEAM_PLANS,
      failures: {
        resubscribe: {
          status: 503,
          message: 'Reactivate service unavailable'
        }
      }
    })
    const canceledStatus = structuredClone(billingApi.state.status)
    await new CloudWorkspaceMockHelper(page).setup(
      originalOwnerMembers(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openPlanAndCredits(page)
    const reactivateButton = content
      .getByRole('button', { name: 'Reactivate plan' })
      .last()

    await reactivateButton.click()

    const errorToast = page.locator('.p-toast-message-error').filter({
      hasText: 'Reactivate service unavailable'
    })
    await expect(errorToast).toContainText('Reactivate service unavailable')
    await expect(reactivateButton).toBeEnabled()
    expect(billingApi.requests.resubscribe).toHaveLength(1)
    expect(billingApi.state.status).toEqual(canceledStatus)
    await expect(
      content.getByText('Your subscription has been canceled', { exact: true })
    ).toBeVisible()
    await expect(
      content.getByText(`Ends on ${formattedEndDate()}`, { exact: true })
    ).toBeVisible()
  })
})

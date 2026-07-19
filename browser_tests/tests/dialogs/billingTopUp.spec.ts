import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  DEFAULT_BILLING_BALANCE,
  DEFAULT_BILLING_PLANS,
  DEFAULT_TEAM_MEMBERS,
  FAILED_BILLING_OPERATION,
  PERSONAL_BILLING_STATUS,
  PENDING_BILLING_OPERATION,
  PENDING_TOPUP_RESPONSE,
  TEAM_CREDIT_BILLING_STATUS,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const PERSONAL_WORKSPACE = workspace('personal', 'owner')

interface BillingRequestCounts {
  balance: number
  status: number
  operations: number
}

function trackBillingRequests(page: Page): BillingRequestCounts {
  const counts: BillingRequestCounts = {
    balance: 0,
    status: 0,
    operations: 0
  }

  page.on('request', (request: Request) => {
    if (request.method() !== 'GET') return

    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/api/billing/balance')) counts.balance += 1
    if (pathname.endsWith('/api/billing/status')) counts.status += 1
    if (pathname.includes('/api/billing/ops/')) counts.operations += 1
  })

  return counts
}

async function bootTopUpDialog(
  page: Page,
  activeWorkspace: WorkspaceWithRole = PERSONAL_WORKSPACE
): Promise<TopUpCreditsDialog> {
  await new CloudWorkspaceMockHelper(page).setup(
    DEFAULT_TEAM_MEMBERS,
    activeWorkspace,
    { mockBilling: false }
  )

  const initialBillingResponses = ['status', 'balance', 'plans'].map(
    (endpoint) =>
      page.waitForResponse((response) => {
        const request = response.request()
        return (
          request.method() === 'GET' &&
          new URL(request.url()).pathname.endsWith(`/api/billing/${endpoint}`)
        )
      })
  )

  await page.goto(APP_URL)
  await Promise.all(initialBillingResponses)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })

  const dialog = new TopUpCreditsDialog(page)
  await dialog.open()
  await expect(dialog.heading).toBeVisible()
  return dialog
}

async function expectWorkspaceCredits(
  page: Page,
  workspaceName: string
): Promise<Locator> {
  const settings = page.getByTestId('settings-dialog')
  await expect(settings).toBeVisible()

  const content = settings.getByRole('main')
  await expect(
    content.getByRole('heading', { name: workspaceName })
  ).toBeVisible()
  await expect(
    content.getByRole('tab', { name: 'Plan & Credits' })
  ).toHaveAttribute('data-state', 'active')
  await expect(content.getByText('Total credits')).toBeVisible()
  return content
}

test.describe('Billing top-up flows', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-05 personal preset posts exact cents and refreshes Plan & Credits', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ status: PERSONAL_BILLING_STATUS })
    const counts = trackBillingRequests(page)
    const dialog = await bootTopUpDialog(page)
    counts.balance = 0
    counts.status = 0

    await dialog.preset10.click()
    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    const content = await expectWorkspaceCredits(page, PERSONAL_WORKSPACE.name)
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 1_000 }])
    expect(billingApi.state.balance).toEqual({
      ...DEFAULT_BILLING_BALANCE,
      amount_micros: 3_500,
      effective_balance_micros: 3_500,
      prepaid_balance_micros: 1_500
    })
    expect(counts.balance).toBeGreaterThanOrEqual(1)
    expect(counts.status).toBeGreaterThanOrEqual(1)
    await expect(content.getByText('7,385', { exact: true })).toBeVisible()
  })

  test('TB-05 custom dollar amount posts exact cents', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ status: PERSONAL_BILLING_STATUS })
    const dialog = await bootTopUpDialog(page)

    await dialog.payAmountInput.click()
    await dialog.payAmountInput.press('ControlOrMeta+A')
    await dialog.payAmountInput.pressSequentially('37')
    await expect(dialog.payAmountInput).toHaveValue('37')
    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    await expectWorkspaceCredits(page, PERSONAL_WORKSPACE.name)
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 3_700 }])
    expect(billingApi.state.balance).toEqual({
      ...DEFAULT_BILLING_BALANCE,
      amount_micros: 6_200,
      effective_balance_micros: 6_200,
      prepaid_balance_micros: 4_200
    })
  })

  test('TB-24 links the ceiling warning to the enterprise page', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ status: PERSONAL_BILLING_STATUS })
    const dialog = await bootTopUpDialog(page)

    await dialog.payAmountInput.fill('10001')

    await expect(dialog.payAmountInput).toHaveValue('10,000')
    await expect(dialog.contactUsLink).toBeVisible()
    await expect(dialog.contactUsLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/cloud/enterprise'
    )
    await expect(dialog.contactUsLink).toHaveAttribute('target', '_blank')
  })

  test('TB-13 team owner top-up returns to the active workspace credit pool', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: TEAM_CREDIT_BILLING_STATUS,
      plans: {
        ...DEFAULT_BILLING_PLANS,
        current_plan_slug: TEAM_CREDIT_BILLING_STATUS.plan_slug
      }
    })
    const dialog = await bootTopUpDialog(page, TEAM_WORKSPACE)

    await dialog.preset100.click()
    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    const content = await expectWorkspaceCredits(page, TEAM_WORKSPACE.name)
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 10_000 }])
    expect(billingApi.state.balance).toEqual({
      ...DEFAULT_BILLING_BALANCE,
      amount_micros: 12_500,
      effective_balance_micros: 12_500,
      prepaid_balance_micros: 10_500
    })
    await expect(content.getByText('26,375', { exact: true })).toBeVisible()
  })

  test('TB-16 pending top-up polls to success and applies one balance increment', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      topupResponse: PENDING_TOPUP_RESPONSE,
      operationResponses: {
        'billing-op-topup': [
          PENDING_BILLING_OPERATION,
          {
            ...PENDING_BILLING_OPERATION,
            status: 'succeeded',
            completed_at: '2099-01-20T00:00:01Z'
          }
        ]
      }
    })
    const counts = trackBillingRequests(page)
    const dialog = await bootTopUpDialog(page)
    counts.balance = 0
    counts.status = 0
    counts.operations = 0

    await dialog.preset25.click()
    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    await expect(
      page.getByText('Processing payment — adding credits...')
    ).toBeVisible()
    await expectWorkspaceCredits(page, PERSONAL_WORKSPACE.name)
    await expect(page.getByText('Credits added successfully')).toBeVisible()
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 2_500 }])
    expect(billingApi.state.balance).toEqual({
      ...DEFAULT_BILLING_BALANCE,
      amount_micros: 5_000,
      effective_balance_micros: 5_000,
      prepaid_balance_micros: 3_000
    })
    expect(counts.operations).toBe(2)
    expect(counts.balance).toBeGreaterThanOrEqual(1)
    expect(counts.status).toBeGreaterThanOrEqual(1)
  })

  test('TB-16 HTTP rejection keeps the balance unchanged and supports retry', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      failures: {
        topup: { status: 402, message: 'Card declined' }
      }
    })
    const initialBalance = structuredClone(billingApi.state.balance)
    const counts = trackBillingRequests(page)
    const dialog = await bootTopUpDialog(page)
    counts.balance = 0
    counts.status = 0

    await dialog.preset25.click()
    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    const errorToast = page.locator('.p-toast-message-error').filter({
      hasText: 'Purchase Failed'
    })
    await expect(errorToast).toContainText('Purchase Failed')
    await expect(errorToast).toContainText('Card declined')
    await expect(dialog.heading).toBeVisible()
    await expect(
      dialog.root.getByRole('button', { name: 'Add credits' })
    ).toBeEnabled()
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 2_500 }])
    expect(billingApi.state.balance).toEqual(initialBalance)
    expect(counts.balance).toBe(0)
    expect(counts.status).toBe(0)
  })

  test('TB-16 failed operation keeps the balance unchanged and surfaces the operation error', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      topupResponse: PENDING_TOPUP_RESPONSE,
      operationResponses: {
        'billing-op-topup': [FAILED_BILLING_OPERATION]
      }
    })
    const initialBalance = structuredClone(billingApi.state.balance)
    const counts = trackBillingRequests(page)
    const dialog = await bootTopUpDialog(page)
    counts.balance = 0
    counts.status = 0
    counts.operations = 0

    await dialog.root.getByRole('button', { name: 'Add credits' }).click()

    const errorToast = page.locator('.p-toast-message-error').filter({
      hasText: 'Top-up failed'
    })
    await expect(errorToast).toContainText('Top-up failed')
    await expect(errorToast).toContainText('Mock billing operation failed')
    await expect(dialog.heading).toBeVisible()
    await expect(
      dialog.root.getByRole('button', { name: 'Add credits' })
    ).toBeEnabled()
    expect(billingApi.requests.topup).toEqual([{ amount_cents: 5_000 }])
    expect(billingApi.state.balance).toEqual(initialBalance)
    expect(counts.operations).toBe(1)
    expect(counts.balance).toBe(0)
    expect(counts.status).toBe(0)
  })
})

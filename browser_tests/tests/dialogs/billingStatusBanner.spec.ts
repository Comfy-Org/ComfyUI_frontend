import type {
  BillingBalanceResponse,
  BillingStatusResponse as GeneratedBillingStatusResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type {
  BillingStatusResponse as WorkspaceBillingStatusResponse,
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import {
  CANCELLED_TEAM_BILLING_STATUS,
  CREATOR,
  DEFAULT_TEAM_MEMBERS,
  TEAM_CREDIT_BILLING_STATUS,
  TEAM_WORKSPACE,
  VIEWER
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const EMPTY_BALANCE: BillingBalanceResponse = {
  amount_micros: 0,
  currency: 'usd',
  effective_balance_micros: 0,
  cloud_credit_balance_micros: 0,
  prepaid_balance_micros: 0
}

type PausedBillingStatusResponse = Omit<
  GeneratedBillingStatusResponse,
  'billing_status'
> &
  Pick<WorkspaceBillingStatusResponse, 'billing_status'>

const OUT_OF_CREDITS_STATUS: GeneratedBillingStatusResponse = {
  ...TEAM_CREDIT_BILLING_STATUS,
  has_funds: false
}

const PAUSED_STATUS: PausedBillingStatusResponse = {
  ...TEAM_CREDIT_BILLING_STATUS,
  is_active: false,
  billing_status: 'paused'
}

function viewerIsOriginalOwner(): Member[] {
  return DEFAULT_TEAM_MEMBERS.map((member) => {
    if (member.id === CREATOR.id) {
      return { ...member, is_original_owner: false }
    }
    if (member.id === VIEWER.id) {
      return { ...member, is_original_owner: true }
    }
    return { ...member }
  })
}

function viewerIsMember(): {
  members: Member[]
  workspace: WorkspaceWithRole
} {
  return {
    members: DEFAULT_TEAM_MEMBERS.map((member) =>
      member.id === VIEWER.id
        ? { ...member, role: 'member' as const }
        : { ...member }
    ),
    workspace: { ...TEAM_WORKSPACE, role: 'member' }
  }
}

async function openWorkspaceSettings(page: Page): Promise<Locator> {
  await page.goto(APP_URL)
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
  await expect(content.getByRole('status')).toBeVisible()
  return content
}

test.describe('Workspace billing status banner', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-22 lets the original owner add credits from an exhausted workspace', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: OUT_OF_CREDITS_STATUS,
      balance: EMPTY_BALANCE
    })
    await new CloudWorkspaceMockHelper(page).setup(
      viewerIsOriginalOwner(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    const content = await openWorkspaceSettings(page)
    const banner = content.getByRole('status')

    await expect(banner).toContainText('Out of credits')
    await expect(banner).toContainText(
      'Add more credits to continue generating'
    )
    await banner.getByRole('button', { name: 'Add credits' }).click()

    await expect(
      page.getByRole('heading', { name: 'Add more credits' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '$50', exact: true })
    ).toBeVisible()
  })

  test('TB-22 directs an exhausted member to workspace admins without a billing action', async ({
    billingApi,
    page
  }) => {
    const { members, workspace } = viewerIsMember()
    await billingApi.setup({
      status: OUT_OF_CREDITS_STATUS,
      balance: EMPTY_BALANCE
    })
    await new CloudWorkspaceMockHelper(page).setup(members, workspace, {
      mockBilling: false
    })
    const content = await openWorkspaceSettings(page)
    const banner = content.getByRole('status')

    await expect(banner).toContainText('Out of credits')
    await expect(banner).toContainText(
      'Your workspace admins need to add more credits'
    )
    await expect(
      banner.getByRole('button', { name: 'Add credits' })
    ).toHaveCount(0)
    await expect(banner.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  })

  test('TB-22 gives a paused owner the payment recovery action', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup()
    await new CloudWorkspaceMockHelper(page).setup(
      viewerIsOriginalOwner(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    await page.route('**/api/billing/status', (route) =>
      route.fulfill({ json: PAUSED_STATUS })
    )
    const content = await openWorkspaceSettings(page)
    const banner = content.getByRole('status')

    await expect(banner).toContainText('Subscription paused')
    await expect(banner).toContainText('Update payment to resume')
    await expect(
      banner.getByRole('button', { name: 'Update payment' })
    ).toBeVisible()
  })

  test('TB-22 limits ending-plan reactivation to the original owner', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ status: CANCELLED_TEAM_BILLING_STATUS })
    const workspaceState = await new CloudWorkspaceMockHelper(page).setup(
      viewerIsOriginalOwner(),
      TEAM_WORKSPACE,
      { mockBilling: false }
    )
    let content = await openWorkspaceSettings(page)
    let banner = content.getByRole('status')

    await expect(banner).toContainText(
      /Your team plan ends on February \d{1,2}, 2099/
    )
    await expect(
      banner.getByRole('button', { name: 'Reactivate plan' })
    ).toBeVisible()

    workspaceState.members.splice(
      0,
      workspaceState.members.length,
      ...DEFAULT_TEAM_MEMBERS.map((member) => ({ ...member }))
    )
    await page.reload()
    content = await openWorkspaceSettings(page)
    banner = content.getByRole('status')

    await expect(banner).toContainText(
      /Your team plan ends on February \d{1,2}, 2099/
    )
    await expect(
      banner.getByRole('button', { name: 'Reactivate plan' })
    ).toHaveCount(0)
  })
})

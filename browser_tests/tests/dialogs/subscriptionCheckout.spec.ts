import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import { SubscriptionCheckoutDialog } from '@e2e/fixtures/components/SubscriptionCheckoutDialog'
import {
  DEFAULT_BILLING_PLANS,
  DEFAULT_BILLING_STATUS,
  DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
  DEFAULT_SUBSCRIBE_RESPONSE
} from '@e2e/fixtures/data/cloudWorkspace'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  member,
  mockWorkspace,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const FEATURES = {
  team_workspaces_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig
const SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true,
  'Comfy.RightSidePanel.ShowErrorsTab': false
}

async function mockGraphBoot(page: Page): Promise<void> {
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
}

async function openCheckout(
  page: Page,
  planMode: '1' | 'team' = '1',
  workspaceType: 'personal' | 'team' = 'personal'
): Promise<SubscriptionCheckoutDialog> {
  const activeWorkspace = workspace(workspaceType, 'owner')
  const members =
    workspaceType === 'team'
      ? [
          member({
            email: 'e2e@test.comfy.org',
            role: 'owner',
            is_original_owner: true
          })
        ]
      : []

  await mockCloudBoot(page, { features: FEATURES, settings: SETTINGS })
  await mockGraphBoot(page)
  await mockWorkspace(page, activeWorkspace, members)
  await page.route('**/api/workspace/invites', (route) =>
    route.fulfill(jsonRoute({ invites: [] }))
  )
  await bootCloud(page)
  await page.goto(`${APP_URL}/?pricing=${planMode}`)

  const dialog = new SubscriptionCheckoutDialog(page)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  return dialog
}

async function chooseStandardYearly(
  dialog: SubscriptionCheckoutDialog
): Promise<void> {
  await dialog.personalPlanButton('Subscribe to Standard Yearly').click()
  await expect(dialog.paymentPreviewHeading).toBeVisible()
}

async function completeStandardCheckout(
  dialog: SubscriptionCheckoutDialog
): Promise<void> {
  await chooseStandardYearly(dialog)
  await dialog.personalPlanButton('Subscribe to Standard').click()
  await expect(dialog.successHeading).toBeVisible()
}

async function openWorkspaceSettings(page: Page) {
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
  return settings.getByRole('main')
}

test.describe('Subscription checkout', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-23 exposes the Terms and Privacy destinations before confirmation', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup()
    const dialog = await openCheckout(page)

    await chooseStandardYearly(dialog)

    await expect(dialog.termsLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/terms-of-service'
    )
    await expect(dialog.termsLink).toHaveAttribute('target', '_blank')
    await expect(dialog.privacyPolicyLink).toHaveAttribute(
      'href',
      'https://www.comfy.org/privacy-policy'
    )
    await expect(dialog.privacyPolicyLink).toHaveAttribute('target', '_blank')
    expect(billingApi.requests.previewSubscribe).toEqual([
      expect.objectContaining({ plan_slug: 'standard-annual' })
    ])
  })

  test('TB-25 shows the selected plan, monthly amount, and credits after subscribe', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup()
    const dialog = await openCheckout(page)

    await completeStandardCheckout(dialog)

    await expect(
      dialog.successContent.getByText('Standard', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.successContent.getByText('$16', { exact: true })
    ).toBeVisible()
    await expect(dialog.successContent.getByText('4,200 / month')).toBeVisible()
    expect(billingApi.requests.subscribe).toEqual([
      expect.objectContaining({ plan_slug: 'standard-annual' })
    ])
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        is_active: true,
        plan_slug: 'standard-annual',
        subscription_duration: 'ANNUAL',
        subscription_tier: 'STANDARD'
      })
    )
  })

  test('TB-21 keeps plan price, cadence, and renewal date consistent in settings', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({
      status: {
        ...DEFAULT_BILLING_STATUS,
        renewal_date: '2099-02-20T12:00:00Z'
      }
    })
    const dialog = await openCheckout(page)

    await completeStandardCheckout(dialog)
    await dialog.root
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await expect(dialog.root).toBeHidden()

    const content = await openWorkspaceSettings(page)
    await expect(
      content.getByText('Standard Yearly', { exact: true })
    ).toBeVisible()
    await expect(content.getByText('$16', { exact: true })).toBeVisible()
    await expect(content.getByText('USD / mo', { exact: true })).toBeVisible()
    await expect(content.getByText('Renews on Feb 20, 2099')).toBeVisible()
  })

  test('TB-14 keeps a team plan change recoverable when subscribe is rejected', async ({
    billingApi,
    page
  }) => {
    const teamStatus: BillingStatusResponse = {
      is_active: true,
      subscription_status: 'active',
      subscription_tier: 'TEAM',
      subscription_duration: 'MONTHLY',
      plan_slug: 'team_per_credit_monthly',
      billing_status: 'paid',
      has_funds: true,
      renewal_date: '2099-02-20T00:00:00Z',
      team_credit_stop: {
        id: 'team_700',
        credits_monthly: 147_700,
        stop_usd: 700
      }
    }
    await billingApi.setup({
      status: teamStatus,
      plans: {
        ...DEFAULT_BILLING_PLANS,
        current_plan_slug: 'team_per_credit_monthly'
      },
      previewResponse: DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
      subscribeResponse: DEFAULT_SUBSCRIBE_RESPONSE,
      failures: {
        subscribe: { status: 500, message: 'Plan change unavailable' }
      }
    })
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    const dialog = await openCheckout(page, 'team', 'team')

    await dialog.personalPlanButton('Change plan').click()
    await expect(dialog.paymentPreviewHeading).toBeVisible()
    await dialog.personalPlanButton('Subscribe to Team Plan').click()

    await expect(page.getByText('Plan change unavailable')).toBeVisible()
    await expect(dialog.paymentPreviewHeading).toBeVisible()
    await expect(dialog.backToPlansButton).toBeEnabled()
    expect(billingApi.requests.subscribe).toEqual([
      expect.objectContaining({
        plan_slug: 'team_per_credit_annual',
        team_credit_stop_id: 'team_700',
        billing_cycle: 'yearly'
      })
    ])
    expect(pageErrors).toEqual([])
  })
})

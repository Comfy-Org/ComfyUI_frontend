import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type {
  BillingStatusResponse,
  PreviewSubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import { SubscriptionCheckoutDialog } from '@e2e/fixtures/components/SubscriptionCheckoutDialog'
import {
  DEFAULT_BILLING_PLANS,
  DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
  DEFAULT_SUBSCRIBE_RESPONSE,
  PENDING_BILLING_OPERATION,
  SUCCEEDED_BILLING_OPERATION
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

function plan(slug: string) {
  const selected = DEFAULT_BILLING_PLANS.plans.find(
    (candidate) => candidate.slug === slug
  )
  if (!selected) throw new Error(`Missing billing plan fixture: ${slug}`)
  return structuredClone(selected)
}

function preview(
  slug: string,
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  const selected = plan(slug)
  return {
    ...DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
    cost_today_cents: selected.price_cents,
    cost_next_period_cents: selected.price_cents,
    credits_today_cents: selected.credits_cents,
    credits_next_period_cents: selected.credits_cents,
    new_plan: selected,
    ...overrides
  }
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
  options: { planMode?: '1' | 'team'; workspaceType?: 'personal' | 'team' } = {}
): Promise<SubscriptionCheckoutDialog> {
  const { planMode = '1', workspaceType = 'personal' } = options
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

async function confirmNewPlan(
  dialog: SubscriptionCheckoutDialog,
  pricingButton: string,
  confirmButton: string
): Promise<void> {
  await dialog.personalPlanButton(pricingButton).click()
  await expect(dialog.paymentPreviewHeading).toBeVisible()
  await dialog.personalPlanButton(confirmButton).click()
  await expect(dialog.successHeading).toBeVisible()
}

test.describe('Subscription transitions', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-01 completes a mocked monthly personal subscription and refreshes status', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ previewResponse: preview('creator-monthly') })
    const dialog = await openCheckout(page)

    await dialog.selectBillingCycle('monthly')
    await confirmNewPlan(dialog, 'Subscribe to Creator', 'Subscribe to Creator')

    expect(billingApi.requests.previewSubscribe).toEqual([
      expect.objectContaining({ plan_slug: 'creator-monthly' })
    ])
    expect(billingApi.requests.subscribe).toEqual([
      expect.objectContaining({ plan_slug: 'creator-monthly' })
    ])
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        subscription_tier: 'CREATOR',
        subscription_duration: 'MONTHLY',
        plan_slug: 'creator-monthly'
      })
    )
  })

  test('TB-01 keeps the annual selection in preview and subscribe requests', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup({ previewResponse: preview('pro-annual') })
    const dialog = await openCheckout(page)

    await confirmNewPlan(dialog, 'Subscribe to Pro Yearly', 'Subscribe to Pro')

    await expect(dialog.root.getByText('$80', { exact: true })).toBeVisible()
    expect(billingApi.requests.previewSubscribe[0]).toEqual(
      expect.objectContaining({ plan_slug: 'pro-annual' })
    )
    expect(billingApi.requests.subscribe[0]).toEqual(
      expect.objectContaining({ plan_slug: 'pro-annual' })
    )
  })

  test('TB-06 sends the selected annual Team stop and shows the refreshed Team plan', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup()
    const dialog = await openCheckout(page, { planMode: 'team' })

    await confirmNewPlan(
      dialog,
      'Subscribe to Team Yearly',
      'Subscribe to Team Plan'
    )

    await expect(
      dialog.successContent.getByText('Team Plan', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.successContent.getByText('$630', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.successContent.getByText('147,700 / month')
    ).toBeVisible()
    expect(billingApi.requests.subscribe[0]).toEqual(
      expect.objectContaining({
        plan_slug: 'team_per_credit_annual',
        team_credit_stop_id: 'team_700',
        billing_cycle: 'yearly'
      })
    )
    expect(billingApi.state.status.team_credit_stop).toEqual(
      expect.objectContaining({ id: 'team_700', credits_monthly: 147_700 })
    )
  })

  test('TB-06 keeps a Team workspace monthly selection in the mutation contract', async ({
    billingApi,
    page
  }) => {
    await billingApi.setup()
    const dialog = await openCheckout(page, {
      planMode: 'team',
      workspaceType: 'team'
    })

    await dialog.selectBillingCycle('monthly')
    await confirmNewPlan(
      dialog,
      'Subscribe to Team Monthly',
      'Subscribe to Team Plan'
    )

    expect(billingApi.requests.subscribe[0]).toEqual(
      expect.objectContaining({
        plan_slug: 'team_per_credit_monthly',
        team_credit_stop_id: 'team_700',
        billing_cycle: 'monthly'
      })
    )
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        subscription_tier: 'TEAM',
        subscription_duration: 'MONTHLY'
      })
    )
  })

  test('TB-09 advances a pending subscription only after its billing operation succeeds', async ({
    billingApi,
    page
  }) => {
    const operationId = 'billing-op-pending-subscribe'
    await billingApi.setup({
      previewResponse: preview('standard-monthly'),
      subscribeResponse: {
        ...DEFAULT_SUBSCRIBE_RESPONSE,
        billing_op_id: operationId,
        status: 'pending_payment'
      },
      operationResponses: {
        [operationId]: [
          { ...PENDING_BILLING_OPERATION, id: operationId },
          { ...SUCCEEDED_BILLING_OPERATION, id: operationId }
        ]
      }
    })
    const dialog = await openCheckout(page)

    await dialog.selectBillingCycle('monthly')
    await confirmNewPlan(
      dialog,
      'Subscribe to Standard',
      'Subscribe to Standard'
    )

    expect(billingApi.requests.subscribe).toHaveLength(1)
    expect(billingApi.requests.previewSubscribe[0]).toEqual(
      expect.objectContaining({ plan_slug: 'standard-monthly' })
    )
    expect(billingApi.state.status).toEqual(
      expect.objectContaining({
        is_active: true,
        plan_slug: 'standard-monthly',
        subscription_status: 'active'
      })
    )
  })

  test('TB-09 confirms an immediate upgrade from the backend preview', async ({
    billingApi,
    page
  }) => {
    const currentStatus: BillingStatusResponse = {
      is_active: true,
      subscription_status: 'active',
      subscription_tier: 'STANDARD',
      subscription_duration: 'MONTHLY',
      plan_slug: 'standard-monthly',
      billing_status: 'paid',
      has_funds: true,
      renewal_date: '2099-02-20T00:00:00Z',
      team_credit_stop: null
    }
    const upgradePreview = preview('pro-annual', {
      transition_type: 'upgrade',
      current_plan: plan('standard-monthly'),
      is_immediate: true
    })
    await billingApi.setup({
      status: currentStatus,
      plans: {
        ...DEFAULT_BILLING_PLANS,
        current_plan_slug: 'standard-monthly'
      },
      previewResponse: upgradePreview
    })
    const dialog = await openCheckout(page)

    await dialog.personalPlanButton('Change to Pro Yearly').click()
    await expect(dialog.upgradePreviewHeading).toBeVisible()
    await expect(dialog.root.getByText('Total due today')).toBeVisible()
    await dialog.personalPlanButton('Confirm upgrade').click()

    await expect(dialog.successHeading).toBeVisible()
    expect(billingApi.requests.previewSubscribe[0]).toEqual(
      expect.objectContaining({ plan_slug: 'pro-annual' })
    )
    expect(billingApi.requests.subscribe[0]).toEqual(
      expect.objectContaining({ plan_slug: 'pro-annual' })
    )
    expect(billingApi.state.status.plan_slug).toBe('pro-annual')
  })
})

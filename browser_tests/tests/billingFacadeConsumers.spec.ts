import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingBalanceResponse,
  BillingStatusResponse
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Billing facade consumers — FE-933 (B3) regression.
 *
 * The repointed surfaces (avatar popover balance, free-tier dialog renewal
 * date) must keep rendering from `useBillingContext`. Cloud
 * personal workspaces route through the workspace `/api/billing/*` endpoints.
 * Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
 * against fully mocked endpoints — same pattern as creditsTile.spec.ts.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

// The workspace `/api/billing/status` shape mirrors the legacy subscription
// status; map the fields so a single test fixture drives both backends.
const toWorkspaceStatus = (
  s: CloudSubscriptionStatusResponse
): BillingStatusResponse => ({
  is_active: s.is_active ?? false,
  max_seats: 1,
  occupied_seats: 1,
  subscription_tier: s.subscription_tier ?? undefined,
  subscription_duration: s.subscription_duration ?? undefined,
  renewal_date: s.renewal_date ?? undefined,
  cancel_at: s.end_date ?? undefined,
  has_funds: s.has_fund ?? true
})

const mockBalance: BillingBalanceResponse = {
  amount_micros: 6000, // -> 12,660 credits
  currency: 'usd',
  effective_balance_micros: 6000
}

const mockWorkspaceBalance: BillingBalanceResponse = {
  amount_micros: 0,
  currency: 'usd',
  effective_balance_micros: 0
}

async function mockCloudBoot(
  page: Page,
  subscriptionStatus: CloudSubscriptionStatusResponse,
  remoteConfig: RemoteConfig = {},
  billingRail?: BillingStatusResponse['billing_rail']
) {
  const billingRequests = {
    legacyStatus: 0,
    legacyBalance: 0,
    workspaceStatus: 0
  }

  await page.route('**/api/features', (r) => r.fulfill(jsonRoute(remoteConfig)))
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // TutorialCompleted suppresses the new-user template browser, whose modal
  // overlay would otherwise intercept clicks on the topbar.
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  // Single personal workspace.
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(
      jsonRoute({
        workspaces: [
          {
            id: 'ws-personal',
            name: 'Personal Workspace',
            type: 'personal',
            role: 'owner'
          }
        ]
      })
    )
  )

  // Legacy endpoints remain mocked for consumers that explicitly use them.
  await page.route('**/customers/cloud-subscription-status', (r) => {
    billingRequests.legacyStatus++
    return r.fulfill(jsonRoute(subscriptionStatus))
  })
  await page.route('**/customers/balance', (r) => {
    billingRequests.legacyBalance++
    return r.fulfill(jsonRoute(mockBalance))
  })

  // Cloud personal workspaces route through `/api/billing/*`.
  await page.route('**/api/billing/status', (r) => {
    billingRequests.workspaceStatus++
    return r.fulfill(
      jsonRoute({
        ...toWorkspaceStatus(subscriptionStatus),
        billing_rail: billingRail
      })
    )
  })
  await page.route('**/api/billing/balance', (r) => {
    return r.fulfill(jsonRoute(mockWorkspaceBalance))
  })
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )

  return billingRequests
}

async function bootApp(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()

  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })

  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
}

test.describe('Billing facade consumers (FE-933)', { tag: '@cloud' }, () => {
  test('avatar popover renders a legacy-rail balance from the facade', async ({
    page
  }) => {
    test.setTimeout(60_000)

    const billingRequests = await mockCloudBoot(
      page,
      {
        is_active: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        renewal_date: '2099-02-20T10:00:00Z',
        end_date: null
      },
      {},
      'legacy_stripe'
    )
    await bootApp(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()

    await expect(popover.getByText('12,660')).toBeVisible()
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
    expect(billingRequests.workspaceStatus).toBeGreaterThan(0)
    expect(billingRequests.legacyStatus).toBeGreaterThan(0)
    expect(billingRequests.legacyBalance).toBeGreaterThan(0)
  })

  test('subscribe-to-run routes an inactive FREE user to the pricing table', async ({
    page
  }) => {
    test.setTimeout(60_000)

    // The facade routes a personal workspace through the workspace
    // `/api/billing/*` endpoints. With
    // subscription gating on, an inactive FREE user gets the "Subscribe to run"
    // button, which opens the pricing table on click. (refreshRemoteConfig
    // overwrites window.__CONFIG__ from /api/features, so the flags must come
    // from the features mock, not an init script.)
    await mockCloudBoot(
      page,
      {
        is_active: false,
        subscription_tier: 'FREE',
        subscription_duration: 'MONTHLY',
        // 10:00Z keeps the en-US calendar date stable across CI timezones.
        renewal_date: '2099-02-20T10:00:00Z',
        end_date: null
      },
      { subscription_required: true }
    )
    await bootApp(page)

    await page.getByTestId('subscribe-to-run-button').click()

    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeVisible()
  })
})

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import {
  PENDING_SUBSCRIPTION_CHECKOUT_EVENT,
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
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
import { TestIds } from '@e2e/fixtures/selectors'
import { FreeTierQuota } from '@e2e/fixtures/components/FreeTierQuota'

/**
 * Billing facade consumers — FE-933 (B3) regression, plus the free-tier
 * quota display (FE-1774: the quota chip renders inside the action bars).
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
  subscriptionStatus: Partial<BillingStatusResponse>,
  remoteConfig: RemoteConfig = {},
  billingRail?: BillingStatusResponse['billing_rail']
) {
  const resolvedSubscriptionStatus: BillingStatusResponse = {
    is_active: false,
    has_funds: false,
    max_seats: 0,
    occupied_seats: 0,
    team_credit_stop: null,
    ...subscriptionStatus,
    ...(billingRail === undefined ? {} : { billing_rail: billingRail })
  }
  const billingRequests = {
    legacyStatus: 0,
    legacyBalance: 0,
    workspaceStatus: 0,
    workspaceBalance: 0
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

  await page.route('**/customers/balance', (r) => {
    billingRequests.legacyBalance++
    return r.fulfill(jsonRoute(mockBalance))
  })
  await page.route('**/customers/cloud-subscription-status', (r) => {
    billingRequests.legacyStatus++
    return r.fulfill(jsonRoute(resolvedSubscriptionStatus))
  })

  // Cloud personal workspaces route through `/api/billing/*`.
  await page.route('**/api/billing/status', (r) => {
    billingRequests.workspaceStatus++
    return r.fulfill(jsonRoute(resolvedSubscriptionStatus))
  })
  await page.route('**/api/billing/balance', (r) => {
    billingRequests.workspaceBalance++
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
        has_funds: true
      },
      {},
      'legacy_stripe'
    )
    await bootApp(page)
    await expect.poll(() => billingRequests.workspaceStatus).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()
    await expect(popover.getByText('12,660')).toBeVisible()

    await page.evaluate((storageKey) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          attempt_id: 'rail-selection-regression',
          started_at_ms: Date.now(),
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change'
        })
      )
    }, PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
    billingRequests.workspaceStatus = 0
    await page.evaluate(
      (eventName) => window.dispatchEvent(new Event(eventName)),
      PENDING_SUBSCRIPTION_CHECKOUT_EVENT
    )

    await expect(popover.getByText('12,660')).toBeVisible()
    await expect(popover.getByText('0', { exact: true })).toHaveCount(0)
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
    expect(billingRequests.legacyStatus).toBe(0)
    expect(billingRequests.legacyBalance).toBeGreaterThan(0)
  })

  test('rollout flag migrates a legacy Stripe workspace to workspace billing', async ({
    page
  }) => {
    test.setTimeout(60_000)

    const billingRequests = await mockCloudBoot(
      page,
      {
        is_active: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        has_funds: true
      },
      { legacy_billing_migration_enabled: true },
      'legacy_stripe'
    )
    await bootApp(page)

    await expect
      .poll(() => billingRequests.workspaceBalance, { timeout: 30_000 })
      .toBeGreaterThan(0)
    expect(billingRequests.legacyStatus).toBe(0)
  })

  const FREE_INACTIVE_SUBSCRIPTION = {
    is_active: false,
    subscription_tier: 'FREE',
    subscription_duration: 'MONTHLY',
    // 10:00Z keeps the en-US calendar date stable across CI timezones.
    renewal_date: '2099-02-20T10:00:00Z',
    has_funds: false
  } as const

  const FREE_TIER_REMOTE_CONFIG = {
    subscription_required: true,
    free_tier_job_allowance_enabled: true,
    free_tier_balance: { allowance: 5, remaining: 3, used: 2 }
  } satisfies RemoteConfig & {
    free_tier_job_allowance_enabled: boolean
  }

  test('renders the 3-of-5 free-tier quota inside the action bars', async ({
    comfyPage,
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(
      page,
      FREE_INACTIVE_SUBSCRIPTION,
      FREE_TIER_REMOTE_CONFIG,
      'stripe'
    )
    await bootApp(page)

    const actionBars = page.getByTestId(TestIds.topbar.actionBars)
    await expect(
      actionBars.getByTestId(TestIds.topbar.freeTierQuota)
    ).toHaveCount(1)

    const quota = new FreeTierQuota(comfyPage)
    await expect.poll(() => quota.getAvailable()).toBe('3')
    await expect.poll(() => quota.getMax()).toBe('5')
  })
})

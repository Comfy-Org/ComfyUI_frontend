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
 * The repointed surfaces (avatar popover tier badge / balance, free-tier
 * dialog renewal date) must keep rendering from `useBillingContext`. The facade
 * selects its backend by flag: `team_workspaces_enabled: false` routes through
 * the legacy `/customers/*` endpoints, while `true` routes a personal workspace
 * through the workspace `/api/billing/*` endpoints. Both shapes are mocked here.
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
  subscription_tier: s.subscription_tier ?? undefined,
  subscription_duration: s.subscription_duration ?? undefined,
  renewal_date: s.renewal_date ?? undefined,
  cancel_at: s.end_date ?? undefined,
  has_funds: s.has_fund ?? true
})

const mockBalance: BillingBalanceResponse = {
  amount_micros: 6000, // -> 12,660 credits
  cloud_credit_balance_micros: 5000,
  currency: 'usd',
  effective_balance_micros: 6000,
  prepaid_balance_micros: 1000
}

const activeProSubscription: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-02-20T10:00:00Z',
  end_date: null
}

const legacyBillingConfig: RemoteConfig = {
  team_workspaces_enabled: false,
  billing_control_enabled: false,
  subscription_required: true
}

const workspaceBillingConfig: RemoteConfig = {
  team_workspaces_enabled: true,
  billing_control_enabled: true,
  subscription_required: true
}

interface BillingBackendRequestCounts {
  legacyBalance: number
  legacyStatus: number
  workspaceBalance: number
  workspaceStatus: number
}

async function mockCloudBoot(
  page: Page,
  subscriptionStatus: CloudSubscriptionStatusResponse,
  remoteConfig: RemoteConfig = { team_workspaces_enabled: false }
): Promise<BillingBackendRequestCounts> {
  const billingRequests: BillingBackendRequestCounts = {
    legacyBalance: 0,
    legacyStatus: 0,
    workspaceBalance: 0,
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

  // Legacy backend (team_workspaces_enabled: false).
  await page.route('**/customers/cloud-subscription-status', (r) => {
    billingRequests.legacyStatus += 1
    return r.fulfill(jsonRoute(subscriptionStatus))
  })
  await page.route('**/customers/balance', (r) => {
    billingRequests.legacyBalance += 1
    return r.fulfill(jsonRoute(mockBalance))
  })

  // Workspace backend (team_workspaces_enabled: true) — a personal workspace
  // now routes through `/api/billing/*`.
  await page.route('**/api/billing/status', (r) => {
    billingRequests.workspaceStatus += 1
    return r.fulfill(jsonRoute(toWorkspaceStatus(subscriptionStatus)))
  })
  await page.route('**/api/billing/balance', (r) => {
    billingRequests.workspaceBalance += 1
    return r.fulfill(jsonRoute(mockBalance))
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
  test('TB-17 keeps the balance consistent from the popover to Plan & Credits', async ({
    page
  }) => {
    test.setTimeout(60_000)

    const billingRequests = await mockCloudBoot(
      page,
      activeProSubscription,
      workspaceBillingConfig
    )
    await bootApp(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()
    await expect(popover.getByText('12,660', { exact: true })).toBeVisible()

    await popover.getByTestId('manage-plan-menu-item').click()

    const dialog = page.getByTestId('settings-dialog')
    await expect(dialog).toBeVisible()
    const content = dialog.getByRole('main')
    await expect(
      content.getByRole('tab', { name: 'Plan & Credits' })
    ).toBeVisible()
    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(content.getByText('12,660', { exact: true })).toBeVisible()
    expect(billingRequests.workspaceStatus).toBeGreaterThanOrEqual(1)
    expect(billingRequests.workspaceBalance).toBeGreaterThanOrEqual(1)
    expect(billingRequests.legacyStatus).toBe(0)
    expect(billingRequests.legacyBalance).toBe(0)
  })

  test('TB-18 keeps the legacy Plan & Credits surface functional with billing flags off', async ({
    page
  }) => {
    test.setTimeout(60_000)

    const billingRequests = await mockCloudBoot(
      page,
      activeProSubscription,
      legacyBillingConfig
    )
    await bootApp(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()
    await popover.getByTestId('manage-plan-menu-item').click()

    const dialog = page.getByTestId('settings-dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Plan & Credits' })
    ).toBeVisible()

    const content = dialog.getByRole('main')
    await expect(
      content.getByText('Subscription', { exact: true })
    ).toBeVisible()
    await expect(content.getByText('Pro', { exact: true })).toBeVisible()
    await expect(content.getByText('$100', { exact: true })).toBeVisible()
    await expect(content.getByText('12,660', { exact: true })).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Manage subscription' })
    ).toBeVisible()
    expect(billingRequests.legacyStatus).toBeGreaterThanOrEqual(1)
    expect(billingRequests.legacyBalance).toBeGreaterThanOrEqual(1)
    expect(billingRequests.workspaceStatus).toBe(0)
    expect(billingRequests.workspaceBalance).toBe(0)
  })

  test('TB-19 keeps workspace-only controls and team pricing out of the legacy path', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, activeProSubscription, legacyBillingConfig)
    await bootApp(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()
    await expect(popover.getByTestId('workspace-switcher-trigger')).toHaveCount(
      0
    )
    await expect(
      popover.getByTestId('workspace-settings-menu-item')
    ).toHaveCount(0)

    await popover.getByTestId('plans-pricing-menu-item').click()

    await expect(
      page.getByRole('heading', { name: 'Plans for Personal Workspace' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'For Teams' })).toHaveCount(0)
  })

  test('avatar popover renders tier badge and balance from the facade', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, {
      is_active: true,
      subscription_tier: 'PRO',
      subscription_duration: 'MONTHLY',
      renewal_date: '2099-02-20T10:00:00Z',
      end_date: null
    })
    await bootApp(page)

    await page.getByRole('button', { name: 'Current user' }).click()
    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()

    await expect(popover.getByText('Pro', { exact: true })).toBeVisible()
    await expect(popover.getByText('12,660')).toBeVisible()
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
  })

  test('free-tier dialog shows the renewal date from the facade', async ({
    page
  }) => {
    test.setTimeout(60_000)

    // Boots with team workspaces enabled (production shape); the facade routes a
    // personal workspace through the workspace `/api/billing/*` endpoints. With
    // subscription gating on, an inactive FREE user gets the "Subscribe to run"
    // button, which opens the free-tier dialog on click. (refreshRemoteConfig
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
      { team_workspaces_enabled: true, subscription_required: true }
    )
    await bootApp(page)

    await page.getByTestId('subscribe-to-run-button').click()

    // T5: the dialog must source the date from facade renewalDate — when this
    // line read the legacy store it silently vanished for team users.
    await expect(
      page.getByText('Your credits refresh on Feb 20, 2099.')
    ).toBeVisible()
  })
})

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

/**
 * Billing facade consumers — FE-933 (B3) regression.
 *
 * The repointed surfaces (avatar popover tier badge / balance, free-tier
 * dialog renewal date) must keep rendering from `useBillingContext`, which in
 * a personal workspace routes through the legacy `/customers/*` endpoints
 * (mocked here). Drives a raw `page` (not the `comfyPage` fixture) so the
 * cloud app boots against fully mocked endpoints — same pattern as
 * creditsTile.spec.ts. `team_workspaces_enabled: false` keeps the topbar on
 * the legacy popover variant that FE-933 repointed.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

async function mockCloudBoot(
  page: Page,
  subscriptionStatus: CloudSubscriptionStatusResponse,
  remoteConfig: RemoteConfig = { team_workspaces_enabled: false }
) {
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
  await page.route('**/api/settings', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  // Single personal workspace: keeps the billing facade on the legacy
  // `/customers/*` path when team workspaces are enabled.
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

  await page.route('**/customers/cloud-subscription-status', (r) =>
    r.fulfill(jsonRoute(subscriptionStatus))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 6000, // -> 12,660 credits
        currency: 'usd',
        effective_balance_micros: 6000
      })
    )
  )
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

    // Subscription gating is config-driven: with subscription_required on,
    // the cloud subscription extension calls requireActiveSubscription() at
    // boot, which opens the free-tier dialog for an inactive FREE user.
    // (refreshRemoteConfig overwrites window.__CONFIG__ from /api/features,
    // so the flag must come from the features mock, not an init script.)
    // The free-tier dialog branch additionally requires an active personal
    // workspace, so this boots with team workspaces enabled (production
    // shape) — the facade still routes personal through `/customers/*`.
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

    // T5: the dialog must source the date from facade renewalDate — when this
    // line read the legacy store it silently vanished for team users.
    await expect(
      page.getByText('Your credits refresh on Feb 20, 2099.')
    ).toBeVisible()
  })
})

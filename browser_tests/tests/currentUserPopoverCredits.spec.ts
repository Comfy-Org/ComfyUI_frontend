import { expect } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingStatusResponse,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'
import type { operations } from '@/types/comfyRegistryTypes'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

type CustomerBalanceResponse = NonNullable<
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']
>

const PERSONAL_WORKSPACE_NAME = 'Personal Workspace'
const FUTURE_DATE = '2099-01-01T00:00:00Z'

const mockRemoteConfig: RemoteConfig = { team_workspaces_enabled: true }

const mockListWorkspacesResponse: { workspaces: WorkspaceWithRole[] } = {
  workspaces: [
    {
      id: 'ws-personal',
      name: PERSONAL_WORKSPACE_NAME,
      type: 'personal',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      role: 'owner'
    }
  ]
}

const mockTokenResponse: WorkspaceTokenResponse = {
  token: 'mock-workspace-token',
  expires_at: FUTURE_DATE,
  workspace: {
    id: 'ws-personal',
    name: PERSONAL_WORKSPACE_NAME,
    type: 'personal'
  },
  role: 'owner',
  permissions: []
}

// Cancelled but still active: `end_date` set (cancelled) while `is_active` is
// true. A personal owner in this state sees BOTH "Add credits" and "Resubscribe"
// in the credits row.
const mockSubscriptionStatus: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_id: 'sub_e2e',
  renewal_date: FUTURE_DATE,
  end_date: FUTURE_DATE
}

// Cancelled-but-active maps to `is_active: true` with
// `subscription_status: 'canceled'`; a paid tier keeps "Add credits" visible.
const mockBillingStatus: BillingStatusResponse = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  subscription_status: 'canceled',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  has_funds: true,
  cancel_at: FUTURE_DATE,
  renewal_date: FUTURE_DATE
}

// ~6.3M credits — a 7-digit balance is what pushes the second action button out
// of the popover before the fix.
const mockBalance: CustomerBalanceResponse = {
  amount_micros: 3_000_000,
  effective_balance_micros: 3_000_000,
  currency: 'usd'
}

// Free tier: the popover swaps "Add credits" for the single contextual
// "Upgrade" action (DES-534). A personal workspace stays on the LEGACY
// billing backend (consolidated billing is off by default), so the tier
// must come from the legacy status response.
const mockFreeTierSubscriptionStatus: CloudSubscriptionStatusResponse = {
  is_active: true,
  subscription_id: 'sub_e2e_free',
  subscription_tier: 'FREE',
  renewal_date: FUTURE_DATE
}

function extendWithWorkspaceMocks(
  legacyStatus: CloudSubscriptionStatusResponse
) {
  return comfyPageFixture.extend({
    page: async ({ page }, use) => {
      // teamWorkspacesEnabled is auth-gated and stays false until the
      // authenticated remote config loads; seed the cached flag (what a
      // returning user has) so the workspace popover — not the legacy one —
      // is what these tests exercise.
      await page.addInitScript(() => {
        localStorage.setItem('team_workspaces_enabled', 'true')
      })

      await page.route('**/api/features', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRemoteConfig)
        })
      )

      await page.route('**/api/workspaces', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback()
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockListWorkspacesResponse)
        })
      })

      await page.route('**/api/auth/token', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTokenResponse)
        })
      )

      await page.route('**/api/auth/session', (route) =>
        route.fulfill({ status: 204 })
      )

      await page.route('**/customers/cloud-subscription-status', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(legacyStatus)
        })
      )

      await page.route('**/customers/balance', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockBalance)
        })
      )

      // A personal workspace stays on legacy billing (consolidated billing
      // defaults off), so the popover's tier/status come from /customers/*
      // above; these workspace endpoints are mocked so bootstrap never 404s.
      await page.route('**/api/billing/status', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockBillingStatus)
        })
      )

      await page.route('**/api/billing/balance', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockBalance)
        })
      )

      await page.route('**/api/billing/plans', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ plans: [] })
        })
      )

      await use(page)
    }
  })
}

const test = extendWithWorkspaceMocks(mockSubscriptionStatus)
const freeTierTest = extendWithWorkspaceMocks(mockFreeTierSubscriptionStatus)

test.describe('Current user popover credits row', { tag: '@cloud' }, () => {
  test('keeps both action buttons inside the popover when cancelled but active', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()

    const popover = page.locator('.current-user-popover')
    await expect(popover).toBeVisible()

    const addCredits = page.getByTestId('add-credits-button')
    const resubscribe = page.getByRole('button', { name: 'Resubscribe' })
    await expect(addCredits).toBeVisible()
    await expect(resubscribe).toBeVisible()

    const popoverBox = await popover.boundingBox()
    const resubscribeBox = await resubscribe.boundingBox()
    expect(popoverBox).not.toBeNull()
    expect(resubscribeBox).not.toBeNull()

    const popoverRight = popoverBox!.x + popoverBox!.width
    const resubscribeRight = resubscribeBox!.x + resubscribeBox!.width
    expect(resubscribeRight).toBeLessThanOrEqual(popoverRight)
  })
})

freeTierTest.describe(
  'Current user popover credits row — free tier',
  { tag: '@cloud' },
  () => {
    freeTierTest(
      'workspace popover shows the single contextual Upgrade action',
      async ({ comfyPage }) => {
        const page = comfyPage.page

        await comfyPage.toast.closeToasts()
        await page.getByTestId(TestIds.user.currentUserButton).click()

        const popover = page.getByTestId(TestIds.user.currentUserPopover)
        await expect(popover).toBeVisible()
        // Both popovers share the container test id and, after this PR, the
        // upgrade button too — so pin the workspace one before asserting on
        // it, or a broken flag seed would silently test the legacy popover.
        await expect(
          popover.getByTestId('workspace-switcher-trigger')
        ).toBeVisible()

        // DES-534: one toned-down "Upgrade" action; plain "Add credits" is
        // paid-tier only.
        const upgrade = popover.getByTestId(
          TestIds.user.upgradeToAddCreditsButton
        )
        await expect(upgrade).toBeVisible()
        await expect(upgrade).toHaveText('Upgrade')
        await expect(popover.getByTestId('add-credits-button')).toBeHidden()
      }
    )
  }
)

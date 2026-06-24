import { expect } from '@playwright/test'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'
import type { operations } from '@/types/comfyRegistryTypes'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

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

// ~6.3M credits — a 7-digit balance is what pushes the second action button out
// of the popover before the fix.
const mockBalance: CustomerBalanceResponse = {
  amount_micros: 3_000_000,
  effective_balance_micros: 3_000_000,
  currency: 'usd'
}

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
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

    await page.route('**/customers/cloud-subscription-status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSubscriptionStatus)
      })
    )

    await page.route('**/customers/balance', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBalance)
      })
    )

    await use(page)
  }
})

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

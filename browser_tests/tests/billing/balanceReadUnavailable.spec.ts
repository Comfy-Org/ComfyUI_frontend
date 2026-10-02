import { expect } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingStatusResponse,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * FE-3164: a *failed* balance read used to render as a literal `0`, so a user
 * whose balance request failed on page load saw `0` coins — indistinguishable
 * from a genuinely empty balance — while their ledger was untouched and the
 * money was still there. During the 2026-10-02 Metronome webhook storm that
 * was everyone who reloaded during a failed read, and one survey respondent
 * reported it as "I just refresh my browser and all of my coins gone".
 *
 * These cases drive the visible credits row rather than the composable, since
 * what was wrong was what the user saw: a number, with no error state and no
 * way to ask again.
 */

const PERSONAL_WORKSPACE_NAME = 'Personal Workspace'
const FUTURE_DATE = '2099-01-01T00:00:00Z'

// 100 cents -> 211 credits (the x2.11 cents-to-credits conversion).
const BALANCE_CENTS = 100
const BALANCE_CREDITS = '211'
const UNAVAILABLE = '—'

const mockRemoteConfig: RemoteConfig = {}

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

const mockBillingStatus: BillingStatusResponse = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  has_funds: true,
  renewal_date: FUTURE_DATE
}

/**
 * Lets a test flip the balance endpoint mid-session. The initial value has to
 * be an option rather than a mutation, because the first read happens while
 * the app boots — which is the state being reproduced. `delayMs` holds a read
 * open so the in-flight window is observable, and `count` is what proves a
 * burst of retry clicks did not become a burst of requests.
 */
type BalanceReads = { fail: boolean; delayMs: number; count: number }

const test = comfyPageFixture.extend<{
  balanceFailsInitially: boolean
  balanceReads: BalanceReads
}>({
  balanceFailsInitially: [false, { option: true }],

  balanceReads: async ({ balanceFailsInitially }, use) => {
    await use({ fail: balanceFailsInitially, delayMs: 0, count: 0 })
  },

  page: async ({ page, balanceReads }, use) => {
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

    await page.route('**/api/billing/capabilities', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createWorkspaceBillingCapabilities(
            mockListWorkspacesResponse.workspaces[0]
          )
        )
      })
    })

    await page.route('**/api/billing/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBillingStatus)
      })
    )

    await page.route('**/api/billing/plans', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans: [] })
      })
    )

    // The upstream failure IR-141 produced: the balance read 5xxs while every
    // other billing read stays healthy.
    const balanceBody = JSON.stringify({
      amount_micros: BALANCE_CENTS,
      effective_balance_micros: BALANCE_CENTS,
      currency: 'usd'
    })
    for (const pattern of ['**/api/billing/balance', '**/customers/balance']) {
      await page.route(pattern, async (route) => {
        balanceReads.count += 1
        if (balanceReads.delayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, balanceReads.delayMs)
          )
        }
        return balanceReads.fail
          ? route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'balance read failed' })
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: balanceBody
            })
      })
    }

    await use(page)
  }
})

test.describe(
  'Credits row when the balance read fails',
  { tag: '@cloud' },
  () => {
    test.describe('with the read failing from page load', () => {
      test.use({ balanceFailsInitially: true })

      test('shows an unavailable, retryable state instead of zero credits', async ({
        comfyPage
      }) => {
        const page = comfyPage.page
        await comfyPage.toast.closeToasts()

        await page.getByTestId(TestIds.user.currentUserButton).click()
        const popover = page.getByTestId(TestIds.user.currentUserPopover)
        await expect(popover).toBeVisible()

        // Asserted on rendered text rather than on this change's own test id,
        // so the case fails on the parent for the defect — a credits row that
        // reads `0` — rather than for a selector that does not exist yet.
        await expect(popover.getByText('0', { exact: true })).toHaveCount(0)
        await expect(
          popover.getByText(UNAVAILABLE, { exact: true })
        ).toBeVisible()

        // The retry carries the state in its accessible name, so the em dash is
        // never the only thing announcing that the balance is unknown.
        await expect(
          popover.getByRole('button', { name: 'Balance unavailable. Retry' })
        ).toBeVisible()
      })

      test('replaces the unavailable state with the balance once a retry succeeds', async ({
        comfyPage,
        balanceReads
      }) => {
        const page = comfyPage.page
        await comfyPage.toast.closeToasts()

        await page.getByTestId(TestIds.user.currentUserButton).click()
        const popover = page.getByTestId(TestIds.user.currentUserPopover)
        await expect(popover.getByText('0', { exact: true })).toHaveCount(0)
        await expect(
          popover.getByText(UNAVAILABLE, { exact: true })
        ).toBeVisible()

        balanceReads.fail = false
        await popover
          .getByRole('button', { name: 'Balance unavailable. Retry' })
          .click()

        await expect(
          popover.getByText(BALANCE_CREDITS, { exact: true })
        ).toBeVisible()
        await expect(
          popover.getByText(UNAVAILABLE, { exact: true })
        ).toHaveCount(0)
      })

      // The retry bound no busy state and no concurrency guard, so it looked
      // inert while it worked and every impatient click started another read.
      // `fetchBalance` has no request-sequence guard on the legacy rail, so two
      // concurrent reads can resolve out of order and the older one wins.
      test('marks the retry busy and coalesces a click burst into one read', async ({
        comfyPage,
        balanceReads
      }) => {
        const page = comfyPage.page
        await comfyPage.toast.closeToasts()

        await page.getByTestId(TestIds.user.currentUserButton).click()
        const popover = page.getByTestId(TestIds.user.currentUserPopover)
        const retry = popover.getByRole('button', {
          name: 'Balance unavailable. Retry'
        })
        await expect(retry).toBeVisible()

        // Hold the next read open so the in-flight window is observable, and
        // let it succeed so the burst cannot be absorbed by a second failure.
        balanceReads.fail = false
        balanceReads.delayMs = 2000
        const readsBefore = balanceReads.count

        await retry.click()
        await expect(retry).toBeDisabled()
        await expect(retry).toHaveAttribute('aria-busy', 'true')

        // Dispatched rather than user-driven: a real user cannot click a
        // disabled control, but a programmatic path can, and the in-flight
        // guard is what has to hold.
        for (let i = 0; i < 3; i++) {
          await retry.dispatchEvent('click')
        }

        await expect(
          popover.getByText(BALANCE_CREDITS, { exact: true })
        ).toBeVisible({ timeout: 10_000 })
        expect(balanceReads.count - readsBefore).toBe(1)
      })
    })

    // A regression guard rather than a proof of the fix: the parent already
    // keeps a balance it has read, because the adapters only overwrite the
    // cached read on success. It is here so the unavailable state cannot later
    // be widened into "any read failure clears the figure".
    test.describe('with the read failing only after a successful one', () => {
      test('keeps the balance already read rather than falling back to zero', async ({
        comfyPage,
        balanceReads
      }) => {
        const page = comfyPage.page
        await comfyPage.toast.closeToasts()

        const userButton = page.getByTestId(TestIds.user.currentUserButton)
        await userButton.click()
        const popover = page.getByTestId(TestIds.user.currentUserPopover)
        const knownBalance = popover.getByText(BALANCE_CREDITS, { exact: true })
        await expect(knownBalance).toBeVisible()

        await userButton.click()
        await expect(popover).toBeHidden()

        // Reopening re-reads the balance, and this time the read fails. Waiting
        // on the 500 keeps the assertions below from passing before it happens.
        balanceReads.fail = true
        const failedRead = page.waitForResponse(
          (response) =>
            /\/(api\/billing|customers)\/balance/.test(response.url()) &&
            response.status() === 500
        )
        await userButton.click()
        await failedRead

        await expect(knownBalance).toBeVisible()
        await expect(popover.getByText('0', { exact: true })).toHaveCount(0)
        await expect(
          popover.getByText(UNAVAILABLE, { exact: true })
        ).toHaveCount(0)
      })
    })
  }
)

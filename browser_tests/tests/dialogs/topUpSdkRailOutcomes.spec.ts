import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupCheckoutResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { makeWorkspaceTokenResponse } from '@e2e/fixtures/data/workspaceAuthFixtures'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { recordOpenedUrl } from '@e2e/fixtures/utils/recordOpenedUrl'
import {
  mockWorkspaceList,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

const OPERATION_ID = 'op-e2e-topup-outcome'
const HOSTED_URL = 'https://pay.stripe.example/invoice/op-e2e-topup-outcome'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_outcome'

const RAIL_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_topup_enabled: true
} satisfies RemoteConfig

const BALANCE = {
  amount_micros: 10_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

const STARTED_AT = '2026-09-20T00:00:00Z'

function operation(
  fields: Omit<BillingOpStatusResponse, 'id' | 'started_at'>
): BillingOpStatusResponse {
  return { id: OPERATION_ID, started_at: STARTED_AT, ...fields }
}

function billingStatus(pendingTopupId?: string): BillingStatusResponse {
  return {
    is_active: true,
    has_funds: true,
    subscription_status: 'active',
    subscription_tier: 'PRO',
    subscription_duration: 'MONTHLY',
    billing_status: 'paid',
    max_seats: 1,
    occupied_seats: 1,
    ended_at: null,
    team_credit_stop: null,
    scheduled_change: null,
    next_charge: null,
    ...(pendingTopupId === undefined
      ? {}
      : {
          pending_billing_op_id: pendingTopupId,
          pending_billing_op_type: 'topup'
        })
  }
}

interface TopupScenario {
  readonly operation: BillingOpStatusResponse
  readonly pendingAtBoot: boolean
}

interface TopupRoutes {
  readonly checkoutRequests: Request[]
  readonly purchaseRequests: Request[]
  readonly pollRequests: Request[]
  setOperation: (next: BillingOpStatusResponse) => void
}

async function setupTopUp(
  page: Page,
  scenario: TopupScenario
): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const checkoutRequests: Request[] = []
  const purchaseRequests: Request[] = []
  const pollRequests: Request[] = []
  let current = scenario.operation

  await recordOpenedUrl(page)
  await setupCloudApp(page, {
    workspace: ws,
    features: RAIL_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_topup_enabled: true
  })

  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(BALANCE))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(
      jsonRoute(
        billingStatus(scenario.pendingAtBoot ? OPERATION_ID : undefined)
      )
    )
  )
  await page.route('**/api/billing/topup/checkout', (route) => {
    checkoutRequests.push(route.request())
    return route.fulfill(
      jsonRoute({
        checkout_url: CHECKOUT_URL
      } satisfies CreateTopupCheckoutResponse)
    )
  })
  await page.route('**/api/billing/topup', (route) => {
    purchaseRequests.push(route.request())
    return route.fulfill({ status: 500 })
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    return route.fulfill(jsonRoute(current))
  })

  return {
    checkoutRequests,
    purchaseRequests,
    pollRequests,
    setOperation: (next) => {
      current = next
    }
  }
}

async function switchWorkspace(page: Page, name: string) {
  await page.getByRole('button', { name: 'Current user' }).click()
  await page.getByTestId('workspace-switcher-trigger').click()
  await Promise.all([
    page.waitForEvent('load'),
    page.getByTestId('workspace-switcher-list').getByText(name).click()
  ])
}

async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function openTopUp(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  return dialog
}

test.describe('Top-up rail outcomes', { tag: '@cloud' }, () => {
  test('mints one checkout for a double-clicked Continue', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page, {
      operation: operation({ status: 'pending', phase: 'in_progress' }),
      pendingAtBoot: false
    })

    const dialog = await openTopUp(page)
    await dialog.continueButton.dblclick()

    await expect(dialog.openedHeading).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute(
      'data-opened-url',
      CHECKOUT_URL
    )
    expect(routes.checkoutRequests).toHaveLength(1)
    expect(routes.checkoutRequests[0].resourceType()).toBe('fetch')
    expect(routes.purchaseRequests).toHaveLength(0)
  })

  test('sends an open top-up the bank is waiting on to its verification page instead of checkout', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page, {
      operation: operation({
        status: 'pending',
        phase: 'awaiting_invoice_payment',
        authentication_state: 'requires_action',
        action_url: HOSTED_URL
      }),
      pendingAtBoot: true
    })

    const dialog = await openTopUp(page)

    await expect(dialog.notice).toHaveAttribute(
      'data-notice',
      'needs_verification'
    )
    await expect(dialog.verifyPaymentLink).toHaveAttribute('href', HOSTED_URL)
    await expect(dialog.continueButton).toHaveCount(0)
    expect(routes.pollRequests.length).toBeGreaterThan(0)
    expect(routes.checkoutRequests).toHaveLength(0)
    expect(routes.purchaseRequests).toHaveLength(0)
  })

  test('points a failed bank verification at support and does not offer checkout', async ({
    page,
    toast
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page, {
      operation: operation({
        status: 'pending',
        phase: 'awaiting_invoice_payment',
        authentication_state: 'failed_retryable',
        decline_reason: 'authentication_failed',
        action_url: HOSTED_URL
      }),
      pendingAtBoot: true
    })

    const dialog = await openTopUp(page)

    await expect(dialog.notice).toHaveAttribute('data-notice', 'not_verified')
    await expect(dialog.contactSupportLink).toBeVisible()
    await expect(dialog.verifyPaymentLink).toHaveCount(0)
    await expect(dialog.continueButton).toHaveCount(0)
    await expect(toast.toastSuccesses).toHaveCount(0)
    expect(routes.checkoutRequests).toHaveLength(0)
    expect(routes.purchaseRequests).toHaveLength(0)
  })

  test('keeps a top-up open in one workspace out of another', async ({
    page,
    toast
  }) => {
    test.setTimeout(150_000)
    const personal = workspace('personal', 'owner')
    const team = workspace('team', 'owner')
    const routes = await setupTopUp(page, {
      operation: operation({ status: 'pending', phase: 'in_progress' }),
      pendingAtBoot: false
    })
    let active = personal
    await mockWorkspaceList(page, [personal, team])
    await page.route('**/api/auth/token', (route) => {
      const { workspace_id } = route.request().postDataJSON() as {
        workspace_id?: string
      }
      active = workspace_id === team.id ? team : personal
      return route.fulfill(
        jsonRoute(
          makeWorkspaceTokenResponse(
            active,
            `mock-workspace-token-${active.id}`
          )
        )
      )
    })
    await page.route('**/api/billing/capabilities', (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill(jsonRoute(createBillingCapabilities(active.id)))
    })
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(
        jsonRoute(
          billingStatus(active.id === personal.id ? OPERATION_ID : undefined)
        )
      )
    )

    const dialog = await openTopUp(page)
    await expect.poll(() => routes.pollRequests.length).toBeGreaterThan(0)

    await dialog.closeButton.click()
    await switchWorkspace(page, team.name)
    await expect.poll(() => active.id).toBe(team.id)
    const pollsBeforeTeam = routes.pollRequests.length
    routes.setOperation(
      operation({ status: 'succeeded', completed_at: '2026-09-20T00:01:00Z' })
    )
    const topUp = await openTopUp(page)
    await expect(topUp.continueButton).toBeEnabled()
    await returnToTab(page)

    expect(routes.pollRequests).toHaveLength(pollsBeforeTeam)
    await expect(toast.toastSuccesses).toHaveCount(0)

    await topUp.closeButton.click()
    await switchWorkspace(page, personal.name)
    await expect(
      toast.toastSuccesses.filter({ hasText: 'Credits added successfully' })
    ).toBeVisible({ timeout: 45_000 })
    expect(routes.pollRequests.length).toBeGreaterThan(pollsBeforeTeam)
    expect(routes.checkoutRequests).toHaveLength(0)
    expect(routes.purchaseRequests).toHaveLength(0)
  })
})

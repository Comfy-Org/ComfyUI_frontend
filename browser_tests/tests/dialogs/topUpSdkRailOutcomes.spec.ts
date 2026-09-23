import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'
import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { makeWorkspaceTokenResponse } from '@e2e/fixtures/data/workspaceAuthFixtures'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  mockWorkspaceList,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

const OPERATION_ID = 'op-e2e-topup-outcome'
const HOSTED_URL = 'https://pay.stripe.example/invoice/op-e2e-topup-outcome'

const RAIL_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_topup_enabled: true
} satisfies RemoteConfig

const SAVED_CARD = {
  id: 'pm_e2e_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

const BALANCE = {
  amount_micros: 10_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

const STARTED_AT = '2026-09-20T00:00:00Z'

function purchase(status: CreateTopupResponse['status']): CreateTopupResponse {
  return {
    billing_op_id: OPERATION_ID,
    topup_id: OPERATION_ID,
    status,
    amount_cents: 5_000
  }
}

function operation(
  fields: Omit<BillingOpStatusResponse, 'id' | 'started_at'>
): BillingOpStatusResponse {
  return { id: OPERATION_ID, started_at: STARTED_AT, ...fields }
}

/** The workspace's billing status, naming the top-up it still has open, if any. */
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
    team_credit_stop: null,
    scheduled_change: null,
    ...(pendingTopupId === undefined
      ? {}
      : {
          pending_billing_op_id: pendingTopupId,
          pending_billing_op_type: 'topup'
        })
  }
}

interface TopupScenario {
  readonly savedCards: SavedPaymentMethod[]
  readonly purchase: CreateTopupResponse
  readonly operation: BillingOpStatusResponse
}

interface TopupRoutes {
  readonly purchaseRequests: Request[]
  readonly pollRequests: Request[]
  readonly balanceRequests: Request[]
  /** How many balance reads had happened when each purchase request arrived. */
  readonly balanceReadsAtPurchase: number[]
  /** What the next poll of the operation answers. */
  setOperation: (next: BillingOpStatusResponse) => void
  /** Every URL the app handed to `window.open`, in order. */
  hostedOpens: () => Promise<string[]>
}

async function setupTopUp(
  page: Page,
  scenario: TopupScenario
): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const purchaseRequests: Request[] = []
  const pollRequests: Request[] = []
  const balanceRequests: Request[] = []
  const balanceReadsAtPurchase: number[] = []
  let current = scenario.operation

  // The hosted page is recorded rather than loaded: network isolation blocks
  // the provider origin, and the offer itself is what is under test.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__hostedOpens', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return null
    }
  })

  await setupCloudApp(page, {
    workspace: ws,
    features: RAIL_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })
  // Otherwise the templates dialog opens once the top-up dialog closes.
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_topup_enabled: true
  })

  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute(scenario.savedCards))
  )
  await page.route('**/api/billing/balance', (route) => {
    balanceRequests.push(route.request())
    return route.fulfill(jsonRoute(BALANCE))
  })
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    purchaseRequests.push(route.request())
    balanceReadsAtPurchase.push(balanceRequests.length)
    return route.fulfill(jsonRoute(scenario.purchase))
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    return route.fulfill(jsonRoute(current))
  })

  return {
    purchaseRequests,
    pollRequests,
    balanceRequests,
    balanceReadsAtPurchase,
    setOperation: (next) => {
      current = next
    },
    hostedOpens: () =>
      page.evaluate(() => [
        ...(window as unknown as { __hostedOpens: string[] }).__hostedOpens
      ])
  }
}

/** Which workspaces hold an operation pointer in this tab's sessionStorage. */
function operationPointerWorkspaces(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('comfy:billing:operation:'))
      .map((key) => key.split(':').at(-1) ?? '')
  )
}

/** Switches through the profile menu, which reloads the app into the target. */
async function switchWorkspace(page: Page, name: string) {
  await page.getByRole('button', { name: 'Current user' }).click()
  await page.getByTestId('workspace-switcher-trigger').click()
  await Promise.all([
    page.waitForEvent('load'),
    page.getByTestId('workspace-switcher-list').getByText(name).click()
  ])
}

/** A customer returning to the tab: the rail polls every pending operation now. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function openConfirmStep(page: Page) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  await dialog.root
    .getByRole('button', { name: 'Add credits', exact: true })
    .click()
  return dialog
}

const payButton = (dialog: TopUpCreditsDialog) =>
  dialog.root.getByRole('button', { name: 'Pay $50.00' })

const successToast = (page: Page) =>
  page.locator('.p-toast-message.p-toast-message-success')

test.describe('Top-up rail outcomes', { tag: '@cloud' }, () => {
  test('sends a purchase with no saved card to the hosted page and settles it on return', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page, {
      savedCards: [],
      purchase: purchase('pending'),
      operation: operation({
        status: 'pending',
        phase: 'awaiting_payment_method',
        action_url: HOSTED_URL
      })
    })

    const dialog = await openConfirmStep(page)
    await payButton(dialog).click()

    await expect(
      dialog.root.getByRole('heading', { name: 'Verify your payment' })
    ).toBeVisible()
    const completeVerification = dialog.root.getByRole('button', {
      name: 'Complete verification'
    })
    await completeVerification.click()
    await expect.poll(() => routes.hostedOpens()).toEqual([HOSTED_URL])

    const balanceReadsBeforeSettlement = routes.balanceRequests.length
    routes.setOperation(
      operation({ status: 'succeeded', completed_at: '2026-09-20T00:01:00Z' })
    )
    await returnToTab(page)

    await expect(
      successToast(page).getByText('Credits added successfully!')
    ).toBeVisible()
    await expect(dialog.root).toBeHidden()
    expect(routes.balanceRequests.length).toBeGreaterThan(
      balanceReadsBeforeSettlement
    )
    expect(routes.purchaseRequests).toHaveLength(1)
    expect(routes.purchaseRequests[0].resourceType()).toBe('fetch')
  })

  test('fails a declined card the way the legacy rail does, without a retry', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page, {
      savedCards: [SAVED_CARD],
      purchase: purchase('failed'),
      operation: operation({
        status: 'failed',
        decline_reason: 'insufficient_funds',
        recovery_action: 'replace_payment_method',
        retryable: true,
        completed_at: '2026-09-20T00:00:01Z'
      })
    })

    const dialog = await openConfirmStep(page)
    await payButton(dialog).click()

    await expect(
      page
        .locator('.p-toast-message.p-toast-message-error')
        .getByText('Purchase Failed')
    ).toBeVisible()
    await expect(payButton(dialog)).toBeEnabled()
    await expect(successToast(page)).toHaveCount(0)
    // A settled purchase re-reads the balance; a declined one must not.
    expect(routes.balanceRequests).toHaveLength(
      routes.balanceReadsAtPurchase[0]
    )
    expect(routes.purchaseRequests).toHaveLength(1)
    expect(routes.purchaseRequests[0].resourceType()).toBe('fetch')
    expect(
      routes.purchaseRequests.filter((r) => r.resourceType() === 'xhr')
    ).toHaveLength(0)
  })

  test('sends one purchase for a double-clicked Pay', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = await setupTopUp(page, {
      savedCards: [SAVED_CARD],
      purchase: purchase('pending'),
      operation: operation({ status: 'pending', phase: 'in_progress' })
    })

    const dialog = await openConfirmStep(page)
    await payButton(dialog).dblclick()

    await expect.poll(() => routes.pollRequests.length).toBeGreaterThan(0)
    await expect(payButton(dialog)).toBeDisabled()
    expect(routes.purchaseRequests).toHaveLength(1)
  })

  test('adopts the open purchase instead of charging again after a reload', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page, {
      savedCards: [SAVED_CARD],
      purchase: purchase('pending'),
      operation: operation({ status: 'pending', phase: 'in_progress' })
    })

    const dialog = await openConfirmStep(page)
    await payButton(dialog).click()
    await expect.poll(() => routes.pollRequests.length).toBeGreaterThan(0)

    await page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(billingStatus(OPERATION_ID)))
    )
    const pollsBeforeReload = routes.pollRequests.length
    await page.goto(`${APP_URL}/?topup=1`)
    await expect(dialog.heading).toBeVisible({ timeout: 45_000 })

    await expect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(pollsBeforeReload)
    await expect(
      dialog.root.getByRole('button', { name: 'Add credits', exact: true })
    ).toBeDisabled()
    expect(routes.purchaseRequests).toHaveLength(1)
  })

  test('keeps a purchase started in one workspace out of another', async ({
    page
  }) => {
    test.setTimeout(150_000)
    const personal = workspace('personal', 'owner')
    const team = workspace('team', 'owner')
    const routes = await setupTopUp(page, {
      savedCards: [SAVED_CARD],
      purchase: purchase('pending'),
      operation: operation({ status: 'pending', phase: 'in_progress' })
    })
    let active = personal
    const personalOpen: { operationId?: string } = {}
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
          billingStatus(
            active.id === personal.id ? personalOpen.operationId : undefined
          )
        )
      )
    )

    const dialog = await openConfirmStep(page)
    await payButton(dialog).click()
    await expect.poll(() => routes.pollRequests.length).toBeGreaterThan(0)
    personalOpen.operationId = OPERATION_ID
    await expect
      .poll(() => operationPointerWorkspaces(page))
      .toEqual([personal.id])

    await dialog.root.getByRole('button', { name: 'Close' }).click()
    await switchWorkspace(page, team.name)
    await expect.poll(() => active.id).toBe(team.id)
    const pollsBeforeTeam = routes.pollRequests.length
    routes.setOperation(
      operation({ status: 'succeeded', completed_at: '2026-09-20T00:01:00Z' })
    )
    const topUp = new TopUpCreditsDialog(page)
    await page.goto(`${APP_URL}/?topup=1`)
    await expect(topUp.heading).toBeVisible({ timeout: 45_000 })
    await expect(
      topUp.root.getByRole('button', { name: 'Add credits', exact: true })
    ).toBeEnabled()
    await returnToTab(page)

    expect(routes.pollRequests).toHaveLength(pollsBeforeTeam)
    await expect(successToast(page)).toHaveCount(0)
    expect(await operationPointerWorkspaces(page)).toEqual([personal.id])

    await topUp.root.getByRole('button', { name: 'Close' }).click()
    await switchWorkspace(page, personal.name)
    await expect(
      successToast(page).getByText('Credits added successfully')
    ).toBeVisible({ timeout: 45_000 })
    expect(routes.pollRequests.length).toBeGreaterThan(pollsBeforeTeam)
    await expect.poll(() => operationPointerWorkspaces(page)).toEqual([])
    expect(routes.purchaseRequests).toHaveLength(1)
  })

  test('shows a failed bank verification with its reason and does not offer it again', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const routes = await setupTopUp(page, {
      savedCards: [SAVED_CARD],
      purchase: purchase('pending'),
      operation: operation({
        status: 'pending',
        phase: 'awaiting_invoice_payment',
        authentication_state: 'requires_action',
        action_url: HOSTED_URL
      })
    })

    const dialog = await openConfirmStep(page)
    await payButton(dialog).click()
    await dialog.root
      .getByRole('button', { name: 'Complete verification' })
      .click()
    await expect.poll(() => routes.hostedOpens()).toEqual([HOSTED_URL])

    const balanceReadsBeforeFailure = routes.balanceRequests.length
    routes.setOperation(
      operation({
        status: 'pending',
        phase: 'awaiting_invoice_payment',
        authentication_state: 'failed_retryable',
        decline_reason: 'authentication_failed',
        action_url: HOSTED_URL
      })
    )
    await returnToTab(page)

    await expect(
      dialog.root.getByText(
        "We couldn't complete payment verification. Please try again."
      )
    ).toBeVisible()
    await expect(
      dialog.root.getByRole('button', { name: 'Start over' })
    ).toBeVisible()
    await expect(
      dialog.root.getByRole('button', { name: 'Complete verification' })
    ).toHaveCount(0)
    await expect(successToast(page)).toHaveCount(0)
    expect(routes.balanceRequests).toHaveLength(balanceReadsBeforeFailure)
    expect(await routes.hostedOpens()).toEqual([HOSTED_URL])
    expect(routes.purchaseRequests).toHaveLength(1)
  })
})

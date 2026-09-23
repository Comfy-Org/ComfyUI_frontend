import type {
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'
import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  createBillingCapabilities,
  createWorkspaceBillingCapabilities
} from '@e2e/fixtures/data/billingCapabilities'
import { makeWorkspaceTokenResponse } from '@e2e/fixtures/data/workspaceAuthFixtures'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  member,
  mockWorkspaceList,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'
import type { Locator, Page, Request, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

/**
 * Recovery on the billing SDK rails with the embedded checkout off: a hosted
 * bank verification the customer abandons, retries, completes, or reloads
 * through, and billing reads that must follow a workspace switch.
 *
 * Covered elsewhere and not repeated here: one adopter for a pending
 * subscription at boot, and the parked hosted page it opens unprompted
 * (`operationRecoverySdkRail.spec.ts`); a failed verification
 * (`topUpSdkRailOutcomes.spec.ts`); a parked subscribe offered once
 * (`subscriptionSdkRailOutcomes.spec.ts`).
 */
const RAIL_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_topup_enabled: true,
  billing_sdk_subscription_enabled: true
} satisfies RemoteConfig

const OPERATION_ID = 'op-e2e-recovery'
const HOSTED_URL = 'https://pay.stripe.example/invoice/op-e2e-recovery'

const SAVED_CARD = {
  id: 'pm-1',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

const BALANCE = {
  amount_micros: 10_000_000,
  currency: 'usd'
} satisfies BillingBalanceResponse

const PENDING_PURCHASE = {
  billing_op_id: OPERATION_ID,
  topup_id: OPERATION_ID,
  status: 'pending',
  amount_cents: 5_000
} satisfies CreateTopupResponse

const STARTED_AT = '2026-09-20T00:00:00Z'

const AWAITING_VERIFICATION = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'pending',
  phase: 'awaiting_invoice_payment',
  authentication_state: 'requires_action',
  action_url: HOSTED_URL
} satisfies BillingOpStatusResponse

/** The bank accepted the challenge; the provider has not settled yet. */
const VERIFIED_PROCESSING = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'pending',
  phase: 'in_progress',
  authentication_state: 'processing'
} satisfies BillingOpStatusResponse

const SUCCEEDED = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'succeeded',
  completed_at: '2026-09-20T00:01:00Z'
} satisfies BillingOpStatusResponse

function billingStatus(
  fields: Partial<BillingStatusResponse> = {}
): BillingStatusResponse {
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
    ...fields
  }
}

async function recordHostedOpens(page: Page) {
  // Recorded rather than loaded: network isolation blocks the provider origin,
  // and the offer itself is what is under test.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__hostedOpens', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })
  return () =>
    page.evaluate(() => [
      ...(window as unknown as { __hostedOpens: string[] }).__hostedOpens
    ])
}

async function enableRails(page: Page) {
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_topup_enabled: true,
    billing_sdk_subscription_enabled: true
  })
}

interface TopupRoutes {
  readonly purchaseRequests: Request[]
  readonly pollRequests: Request[]
  /** What the next poll of the operation answers. */
  setOperation: (next: BillingOpStatusResponse) => void
  hostedOpens: () => Promise<string[]>
}

async function setupTopUp(page: Page): Promise<TopupRoutes> {
  const ws = workspace('personal', 'owner')
  const purchaseRequests: Request[] = []
  const pollRequests: Request[] = []
  let current: BillingOpStatusResponse = AWAITING_VERIFICATION
  let serverReportsPending = false

  const hostedOpens = await recordHostedOpens(page)
  await setupCloudApp(page, {
    workspace: ws,
    features: RAIL_FEATURES,
    billingCapabilities: createBillingCapabilities(ws.id)
  })
  // Otherwise the templates dialog opens once the top-up dialog closes.
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await enableRails(page)

  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([SAVED_CARD]))
  )
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(BALANCE))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(
      jsonRoute(
        billingStatus(
          serverReportsPending
            ? {
                pending_billing_op_id: OPERATION_ID,
                pending_billing_op_type: 'topup'
              }
            : {}
        )
      )
    )
  )
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    purchaseRequests.push(route.request())
    serverReportsPending = true
    return route.fulfill(jsonRoute(PENDING_PURCHASE))
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    if (current.status !== 'pending') serverReportsPending = false
    return route.fulfill(jsonRoute(current))
  })

  return {
    purchaseRequests,
    pollRequests,
    setOperation: (next) => {
      current = next
    },
    hostedOpens
  }
}

/** A customer returning to the tab: the rail polls every pending operation now. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function payAndOpenVerification(page: Page, routes: TopupRoutes) {
  const dialog = new TopUpCreditsDialog(page)
  await page.goto(`${APP_URL}/?topup=1`)
  await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
  await dialog.root
    .getByRole('button', { name: 'Add credits', exact: true })
    .click()
  await dialog.root.getByRole('button', { name: 'Pay $50.00' }).click()
  await expect(
    dialog.root.getByRole('heading', { name: 'Verify your payment' })
  ).toBeVisible()
  await completeVerification(dialog).click()
  await expect.poll(() => routes.hostedOpens()).toEqual([HOSTED_URL])
  return dialog
}

const completeVerification = (dialog: TopUpCreditsDialog) =>
  dialog.root.getByRole('button', { name: 'Complete verification' })

const successToast = (page: Page) =>
  page
    .locator('.p-toast-message.p-toast-message-success')
    .getByText('Credits added successfully')

function transports(requests: Request[]): string[] {
  return requests.map((request) => request.resourceType())
}

function operationIdsPolled(requests: Request[]): Set<string> {
  return new Set(
    requests.map(
      (request) => new URL(request.url()).pathname.split('/').at(-1) ?? ''
    )
  )
}

const CREATOR_ANNUAL_PLAN = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 33_600,
  credits_cents: 7_400,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 33_600,
    total_credits_cents: 7_400
  }
} satisfies Plan

const UPGRADE_TO_CREATOR = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const ACTIVE_STANDARD = billingStatus({
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  renewal_date: '2099-02-20T00:00:00Z'
})

interface SubscriptionRoutes {
  readonly subscribeRequests: Request[]
  readonly pollRequests: Request[]
  setOperation: (next: BillingOpStatusResponse) => void
  hostedOpens: () => Promise<string[]>
}

async function setupSubscription(
  page: Page,
  features: RemoteConfig = RAIL_FEATURES
): Promise<SubscriptionRoutes> {
  const ws = workspace('personal', 'owner')
  const subscribeRequests: Request[] = []
  const pollRequests: Request[] = []
  let current: BillingOpStatusResponse = AWAITING_VERIFICATION

  const hostedOpens = await recordHostedOpens(page)
  await setupCloudApp(page, {
    workspace: ws,
    members: [
      member({
        email: CLOUD_SELF_EMAIL,
        role: 'owner',
        is_original_owner: true
      })
    ],
    features,
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  if (features.billing_sdk_subscription_enabled) await enableRails(page)

  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([SAVED_CARD]))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({
        current_plan_slug: 'standard-annual',
        plans: [CREATOR_ANNUAL_PLAN]
      })
    )
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(UPGRADE_TO_CREATOR))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(
      jsonRoute(
        subscribeRequests.length > 0 && current.status === 'pending'
          ? {
              ...ACTIVE_STANDARD,
              pending_billing_op_id: OPERATION_ID,
              pending_billing_op_type: 'subscription'
            }
          : ACTIVE_STANDARD
      )
    )
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    return route.fulfill(
      jsonRoute({
        billing_op_id: OPERATION_ID,
        status: 'needs_payment_method',
        payment_method_url: HOSTED_URL
      })
    )
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    return route.fulfill(jsonRoute(current))
  })

  return {
    subscribeRequests,
    pollRequests,
    setOperation: (next) => {
      current = next
    },
    hostedOpens
  }
}

async function confirmUpgrade(page: Page) {
  await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
  await expect(
    page.getByRole('heading', { name: 'Confirm your upgrade' })
  ).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()
}

interface WorkspaceBilling {
  readonly status: BillingStatusResponse
  readonly usageRow: string
}

interface WorkspaceRoutes {
  readonly eventRequests: Request[]
  /** The first usage-log read, held until the test releases it. */
  readonly heldEvents: Promise<Route>
}

function eventsPage(apiName: string): BillingEventsResponse {
  return {
    events: [
      {
        event_id: `evt-${apiName}`,
        event_type: 'api_usage_completed',
        createdAt: '2026-09-20T00:00:00Z',
        params: { api_name: apiName }
      }
    ],
    page: 1,
    limit: 7,
    total: 1,
    totalPages: 1
  }
}

async function setupTwoWorkspaces(
  page: Page,
  billing: Map<WorkspaceWithRole, WorkspaceBilling>,
  { holdFirstEvents = false }: { holdFirstEvents?: boolean } = {}
): Promise<WorkspaceRoutes> {
  const [first] = billing.keys()
  const eventRequests: Request[] = []
  let active = first
  let releaseHeld: (route: Route) => void = () => {}
  const heldEvents = new Promise<Route>((resolve) => {
    releaseHeld = resolve
  })

  await setupCloudApp(page, {
    workspace: first,
    features: RAIL_FEATURES,
    billingCapabilities: createBillingCapabilities(first.id)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await enableRails(page)
  await mockWorkspaceList(page, [...billing.keys()])
  await page.route('**/api/auth/token', (route) => {
    const { workspace_id } = route.request().postDataJSON() as {
      workspace_id?: string
    }
    active = [...billing.keys()].find((ws) => ws.id === workspace_id) ?? first
    return route.fulfill(
      jsonRoute(
        makeWorkspaceTokenResponse(active, `mock-workspace-token-${active.id}`)
      )
    )
  })
  await page.route('**/api/billing/capabilities', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute(createBillingCapabilities(active.id)))
  })
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(billing.get(active)!.status))
  )
  await page.route('**/api/billing/events**', (route) => {
    eventRequests.push(route.request())
    if (holdFirstEvents && eventRequests.length === 1) {
      releaseHeld(route)
      return
    }
    return route.fulfill(jsonRoute(eventsPage(billing.get(active)!.usageRow)))
  })

  return { eventRequests, heldEvents }
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

async function openPlanAndCredits(page: Page): Promise<Locator> {
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click({ timeout: 45_000 })
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()
  return dialog.getByRole('main')
}

async function openActivity(content: Locator) {
  await content.getByRole('button', { name: 'Activity', exact: true }).click()
}

const PERSONAL = workspace('personal', 'owner')
const TEAM = workspace('team', 'owner')

const SUBSCRIBED_PRO = billingStatus({
  plan_slug: 'pro-monthly',
  renewal_date: '2099-02-20T10:00:00Z'
})

const UNSUBSCRIBED = billingStatus({
  is_active: false,
  subscription_status: undefined,
  subscription_tier: undefined,
  subscription_duration: undefined,
  billing_status: undefined
})

test.describe('Billing recovery on the SDK rails', { tag: '@cloud' }, () => {
  test.describe('workspace scoping', () => {
    test('shows only the new workspace usage when a switch lands mid-load', async ({
      page
    }) => {
      test.setTimeout(120_000)
      const routes = await setupTwoWorkspaces(
        page,
        new Map([
          [PERSONAL, { status: SUBSCRIBED_PRO, usageRow: 'usage-in-personal' }],
          [TEAM, { status: SUBSCRIBED_PRO, usageRow: 'usage-in-team' }]
        ]),
        { holdFirstEvents: true }
      )
      await page.goto(APP_URL)

      const personalContent = await openPlanAndCredits(page)
      await openActivity(personalContent)
      const held = await routes.heldEvents
      await page.keyboard.press('Escape')
      await switchWorkspace(page, TEAM.name)
      await held
        .fulfill(jsonRoute(eventsPage('usage-in-personal')))
        .catch(() => {})

      const teamContent = await openPlanAndCredits(page)
      await openActivity(teamContent)

      await expect(teamContent.getByText('usage-in-team')).toBeVisible()
      await expect(teamContent.getByText('usage-in-personal')).toHaveCount(0)
      const teamRead = routes.eventRequests.at(-1)!
      expect(teamRead.resourceType()).toBe('fetch')
      expect(teamRead.headers()['authorization']).toBe(
        `Bearer mock-workspace-token-${TEAM.id}`
      )
    })

    test('shows the unsubscribed state after switching away from a subscribed workspace', async ({
      page
    }) => {
      test.setTimeout(120_000)
      await setupTwoWorkspaces(
        page,
        new Map([
          [PERSONAL, { status: SUBSCRIBED_PRO, usageRow: 'usage-in-personal' }],
          [TEAM, { status: UNSUBSCRIBED, usageRow: 'usage-in-team' }]
        ])
      )
      await page.goto(APP_URL)

      const personalContent = await openPlanAndCredits(page)
      await expect(personalContent.getByText(/Renews on/)).toBeVisible()
      await page.keyboard.press('Escape')
      await switchWorkspace(page, TEAM.name)

      const teamContent = await openPlanAndCredits(page)
      await expect(
        teamContent.getByText('This workspace is not on a subscription')
      ).toBeVisible()
      await expect(
        teamContent.getByRole('button', { name: 'Subscribe Now' })
      ).toBeVisible()
      await expect(teamContent.getByText(/Renews on/)).toHaveCount(0)
    })
  })

  test.describe('hosted bank verification', () => {
    test('offers the verification again after the customer abandons the hosted page', async ({
      page
    }) => {
      test.setTimeout(90_000)
      const routes = await setupTopUp(page)
      const dialog = await payAndOpenVerification(page, routes)

      const pollsBeforeReturn = routes.pollRequests.length
      await returnToTab(page)
      await expect
        .poll(() => routes.pollRequests.length)
        .toBeGreaterThan(pollsBeforeReturn)

      await expect(completeVerification(dialog)).toBeEnabled()
      await expect(completeVerification(dialog)).not.toHaveAttribute(
        'aria-busy'
      )
      await expect(successToast(page)).toHaveCount(0)
    })

    test('settles the same purchase when the customer retries the verification', async ({
      page
    }) => {
      test.setTimeout(90_000)
      const routes = await setupTopUp(page)
      const dialog = await payAndOpenVerification(page, routes)
      await returnToTab(page)

      await completeVerification(dialog).click()
      await expect
        .poll(() => routes.hostedOpens())
        .toEqual([HOSTED_URL, HOSTED_URL])
      routes.setOperation(SUCCEEDED)
      await returnToTab(page)

      await expect(successToast(page)).toBeVisible()
      await expect(dialog.root).toBeHidden()
      expect(routes.purchaseRequests).toHaveLength(1)
      expect(operationIdsPolled(routes.pollRequests)).toEqual(
        new Set([OPERATION_ID])
      )
      expect(transports(routes.pollRequests)).not.toContain('xhr')
    })

    test('does not offer the verification again once the bank has accepted it', async ({
      page
    }) => {
      test.setTimeout(90_000)
      const routes = await setupTopUp(page)
      const dialog = await payAndOpenVerification(page, routes)

      routes.setOperation(VERIFIED_PROCESSING)
      // Several polls of the processing state, the window in which an echo of
      // the finished challenge would put the offer back.
      for (let visit = 0; visit < 3; visit++) {
        const polls = routes.pollRequests.length
        await returnToTab(page)
        await expect
          .poll(() => routes.pollRequests.length)
          .toBeGreaterThan(polls)
      }

      await expect(
        page
          .locator('.p-toast-message')
          .getByText('Verify your payment to add your credits')
      ).toHaveCount(0)
      // Shown as work in progress, not as a step the customer still owes.
      await expect(completeVerification(dialog)).toBeDisabled()
      await expect(completeVerification(dialog)).toHaveAttribute(
        'aria-busy',
        'true'
      )
      expect(await routes.hostedOpens()).toEqual([HOSTED_URL])
      expect(routes.purchaseRequests).toHaveLength(1)
    })

    test('reports the outcome of a verified purchase after a reload', async ({
      page
    }) => {
      test.setTimeout(120_000)
      const routes = await setupTopUp(page)
      await payAndOpenVerification(page, routes)

      routes.setOperation(VERIFIED_PROCESSING)
      const pollsBeforeReload = routes.pollRequests.length
      await page.reload()
      await expect
        .poll(() => routes.pollRequests.length, { timeout: 45_000 })
        .toBeGreaterThan(pollsBeforeReload)
      routes.setOperation(SUCCEEDED)
      await returnToTab(page)

      await expect(successToast(page)).toBeVisible({ timeout: 45_000 })
      expect(routes.purchaseRequests).toHaveLength(1)
      expect(transports(routes.pollRequests)).not.toContain('xhr')
      // The step was already done, so the reload has nothing to reopen.
      expect(await routes.hostedOpens()).toEqual([])
    })
  })

  test.describe('hosted bank verification for a subscription', () => {
    test('offers the verification again after the customer abandons it, and settles the same subscribe', async ({
      page
    }) => {
      test.setTimeout(90_000)
      const routes = await setupSubscription(page)
      await confirmUpgrade(page)
      await expect.poll(() => routes.hostedOpens()).toEqual([HOSTED_URL])

      const pollsBeforeReturn = routes.pollRequests.length
      await returnToTab(page)
      await expect
        .poll(() => routes.pollRequests.length)
        .toBeGreaterThan(pollsBeforeReturn)
      const retry = page.getByRole('button', { name: 'Complete verification' })
      await expect(retry).toBeEnabled()

      await retry.click()
      await expect
        .poll(() => routes.hostedOpens())
        .toEqual([HOSTED_URL, HOSTED_URL])
      routes.setOperation(SUCCEEDED)
      await returnToTab(page)

      await expect(
        page.getByRole('heading', { name: "You're all set" })
      ).toBeVisible()
      expect(routes.subscribeRequests).toHaveLength(1)
      expect(operationIdsPolled(routes.pollRequests)).toEqual(
        new Set([OPERATION_ID])
      )
    })
  })
})

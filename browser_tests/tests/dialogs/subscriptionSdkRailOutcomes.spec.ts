import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeResponse,
  SavedPaymentMethod,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Subscription outcomes the other SDK-rail specs leave uncovered: leaving a
 * team plan for a personal one, a subscribe parked on a hosted payment page,
 * a session where only the subscription rail is on, and the end date a
 * cancelled plan shows once the page is reloaded.
 *
 * As in `planChangeSdkRail.spec.ts`, the transport is what tells the rails
 * apart: the SDK runs on `fetch` and keys every write, the legacy workspace
 * client runs on axios' XHR adapter and keys none.
 */
const SUBSCRIPTION_RAIL_ONLY = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_subscription_enabled: true,
  billing_sdk_topup_enabled: false
} satisfies RemoteConfig

const OPERATION_ID = 'op-e2e-outcome'
const HOSTED_PAYMENT_URL = 'https://checkout.stripe.example/pay/op-e2e-outcome'

function annualPlan(
  slug: string,
  tier: Plan['tier'],
  priceCents: number,
  creditsCents: number
): Plan {
  return {
    slug,
    tier,
    duration: 'ANNUAL',
    price_cents: priceCents,
    credits_cents: creditsCents,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    }
  }
}

const STANDARD_ANNUAL_PLAN = annualPlan(
  'standard-annual',
  'STANDARD',
  19_200,
  4_200
)
const CREATOR_ANNUAL_PLAN = annualPlan(
  'creator-annual',
  'CREATOR',
  33_600,
  7_400
)
const PRO_ANNUAL_PLAN = annualPlan('pro-annual', 'PRO', 96_000, 21_100)

const ACTIVE_STANDARD_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_rail: 'stripe',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: null,
  scheduled_change: null,
  max_seats: 1,
  occupied_seats: 1
} satisfies BillingStatusResponse

const ACTIVE_TEAM_STATUS = {
  ...ACTIVE_STANDARD_STATUS,
  subscription_tier: 'TEAM',
  plan_slug: 'team_per_credit_annual',
  team_credit_stop: { id: 'team_700', credits_monthly: 147_700, stop_usd: 700 },
  max_seats: 5
} satisfies BillingStatusResponse

const SETTLED_OPERATION = {
  id: OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-21T00:00:00Z',
  completed_at: '2026-09-21T00:00:05Z'
} satisfies BillingOpStatusResponse

const PARKED_OPERATION = {
  id: OPERATION_ID,
  status: 'pending',
  phase: 'awaiting_payment_method',
  action_url: HOSTED_PAYMENT_URL,
  started_at: '2026-09-21T00:00:00Z'
} satisfies BillingOpStatusResponse

function quote(
  transitionType: PreviewSubscribeResponse['transition_type'],
  plan: Plan
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: transitionType,
    effective_at: '2026-09-21T00:00:00Z',
    is_immediate: true,
    cost_today_cents: plan.price_cents,
    cost_next_period_cents: plan.price_cents,
    credits_today_cents: plan.credits_cents,
    credits_next_period_cents: plan.credits_cents,
    new_plan: plan
  }
}

interface RailRoutes {
  readonly subscribeRequests: Request[]
  readonly previewRequests: Request[]
  readonly opsRequests: Request[]
  readonly cancelRequests: Request[]
  readonly topupRequests: Request[]
  readonly statusRequests: Request[]
  readonly memberRemovals: Request[]
  /** Every URL the app asked the browser to open, in order. */
  openedUrls: () => Promise<string[]>
}

interface RailSetup {
  workspace: WorkspaceWithRole
  billingStatus: () => BillingStatusResponse
  plans?: BillingPlansResponse
  preview?: PreviewSubscribeResponse
  subscribeResponse?: SubscribeResponse
  operation?: () => BillingOpStatusResponse
  onCancel?: () => void
}

async function setupRail(page: Page, setup: RailSetup): Promise<RailRoutes> {
  const routes = {
    subscribeRequests: [] as Request[],
    previewRequests: [] as Request[],
    opsRequests: [] as Request[],
    cancelRequests: [] as Request[],
    topupRequests: [] as Request[],
    statusRequests: [] as Request[],
    memberRemovals: [] as Request[]
  }

  // Recorded rather than performed: a hosted page is an external origin, and
  // the truthy return keeps the popup-blocked fallback out of these rows.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__openedUrls', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })

  await setupCloudApp(page, {
    workspace: setup.workspace,
    members: [
      member({
        email: CLOUD_SELF_EMAIL,
        role: 'owner',
        is_original_owner: true
      })
    ],
    features: SUBSCRIPTION_RAIL_ONLY,
    billingCapabilities: createWorkspaceBillingCapabilities(setup.workspace)
  })
  // The handshake is the fallback channel; seeding it too keeps the two
  // channels agreeing, so neither alone is what the rows rest on.
  await new FeatureFlagHelper(page).seedServerFlags({
    billing_sdk_subscription_enabled: true,
    billing_sdk_topup_enabled: false
  })

  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/billing/status', (route) => {
    routes.statusRequests.push(route.request())
    return route.fulfill(jsonRoute(setup.billingStatus()))
  })
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(setup.plans ?? { plans: [] }))
  )
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(
      jsonRoute([
        {
          id: 'pm_e2e_visa',
          type: 'card',
          brand: 'visa',
          last4: '4242',
          is_default: true
        }
      ] satisfies SavedPaymentMethod[])
    )
  )
  await page.route('**/api/billing/preview-subscribe', (route) => {
    routes.previewRequests.push(route.request())
    return route.fulfill(jsonRoute(setup.preview ?? {}))
  })
  await page.route('**/api/billing/subscribe', (route) => {
    routes.subscribeRequests.push(route.request())
    return route.fulfill(
      jsonRoute(
        setup.subscribeResponse ?? {
          billing_op_id: OPERATION_ID,
          status: 'subscribed'
        }
      )
    )
  })
  await page.route('**/api/billing/subscription/cancel', (route) => {
    routes.cancelRequests.push(route.request())
    setup.onCancel?.()
    return route.fulfill(
      jsonRoute({ billing_op_id: OPERATION_ID, status: 'pending' })
    )
  })
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    routes.topupRequests.push(route.request())
    return route.fulfill(
      jsonRoute({
        billing_op_id: 'op-e2e-topup',
        topup_id: 'topup-e2e',
        status: 'completed',
        amount_cents: 5_000
      } satisfies CreateTopupResponse)
    )
  })
  await page.route('**/api/billing/ops/**', (route) => {
    routes.opsRequests.push(route.request())
    return route.fulfill(jsonRoute(setup.operation?.() ?? SETTLED_OPERATION))
  })
  await page.route('**/api/workspace/members/**', (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    routes.memberRemovals.push(route.request())
    return route.fulfill({ status: 204, body: '' })
  })

  return {
    ...routes,
    openedUrls: () =>
      page.evaluate(
        () =>
          (window as Window & { __openedUrls?: string[] }).__openedUrls ?? []
      )
  }
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

/** Which transport issued the request, and so which rail served it. */
function transport(request: Request): string {
  return request.resourceType()
}

/** Settings ▸ Workspace ▸ Plan & Credits. */
async function openPlanAndCredits(page: Page) {
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()
  return dialog.getByRole('main')
}

/** A customer coming back to this tab from the hosted page. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

const successHeading = (page: Page) =>
  page.getByRole('heading', { name: "You're all set" })

test.describe('Subscription rail outcomes', { tag: '@cloud' }, () => {
  test('moves a team plan to a personal plan through the SDK transport', async ({
    page
  }) => {
    const routes = await setupRail(page, {
      workspace: workspace('team', 'owner'),
      billingStatus: () => ACTIVE_TEAM_STATUS,
      plans: {
        current_plan_slug: 'team_per_credit_annual',
        plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN, PRO_ANNUAL_PLAN]
      },
      preview: quote('downgrade', CREATOR_ANNUAL_PLAN)
    })

    await page.goto(`${APP_URL}/?pricing=personal`)
    await cloudAppExpect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeVisible()
    await page
      .getByRole('button', { name: /Creator Yearly$/ })
      .first()
      .click()

    await cloudAppExpect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      plan_slug: 'creator-annual',
      idempotency_key: idempotencyKey(issued)
    })
    expect(routes.previewRequests.length).toBeGreaterThan(0)
    expect(routes.previewRequests.map(transport)).not.toContain('xhr')
    // The owner is the only member, so nothing is removed before billing.
    expect(routes.memberRemovals).toHaveLength(0)
  })

  test('opens the hosted payment page once for a parked subscribe, and settles when the operation succeeds', async ({
    page
  }) => {
    let operation: BillingOpStatusResponse = PARKED_OPERATION
    const routes = await setupRail(page, {
      workspace: workspace('personal', 'owner'),
      billingStatus: () => ACTIVE_STANDARD_STATUS,
      plans: {
        current_plan_slug: 'standard-annual',
        plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN]
      },
      preview: quote('upgrade', CREATOR_ANNUAL_PLAN),
      subscribeResponse: {
        billing_op_id: OPERATION_ID,
        status: 'needs_payment_method',
        payment_method_url: HOSTED_PAYMENT_URL
      },
      operation: () => operation
    })

    await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
    await cloudAppExpect(
      page.getByRole('heading', { name: 'Confirm your upgrade' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Confirm upgrade' }).click()

    await expect.poll(() => routes.openedUrls()).toEqual([HOSTED_PAYMENT_URL])
    expect(routes.subscribeRequests).toHaveLength(1)
    expect(transport(routes.subscribeRequests[0])).toBe('fetch')

    // A poll that still reports the same parked step must not offer it again.
    const pollsBefore = routes.opsRequests.length
    await returnToTab(page)
    await expect
      .poll(() => routes.opsRequests.length)
      .toBeGreaterThan(pollsBefore)
    await expect(successHeading(page)).toBeHidden()
    expect(await routes.openedUrls()).toEqual([HOSTED_PAYMENT_URL])

    operation = SETTLED_OPERATION
    await returnToTab(page)

    await expect(successHeading(page)).toBeVisible()
    expect(await routes.openedUrls()).toEqual([HOSTED_PAYMENT_URL])
    expect(routes.subscribeRequests).toHaveLength(1)
    expect(routes.opsRequests.map(transport)).not.toContain('xhr')
  })

  test('keeps each write on its own rail when only the subscription rail is on', async ({
    page
  }) => {
    const routes = await setupRail(page, {
      workspace: workspace('personal', 'owner'),
      billingStatus: () => ACTIVE_STANDARD_STATUS
    })
    await page.goto(APP_URL)
    await waitForCloudApp(page)

    const cancelDialog = new CancelSubscriptionDialog(page)
    await cancelDialog.open('2099-02-20T00:00:00Z')
    await cancelDialog.confirmCancelButton.click()
    await expect(cancelDialog.root).toBeHidden()

    const topUp = new TopUpCreditsDialog(page)
    await topUp.open()
    await topUp.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()
    await topUp.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect.poll(() => routes.topupRequests.length).toBe(1)
    expect(routes.cancelRequests).toHaveLength(1)
    const [cancel] = routes.cancelRequests
    expect(transport(cancel)).toBe('fetch')
    expect(idempotencyKey(cancel)).toBeTruthy()
    const [topup] = routes.topupRequests
    expect(transport(topup)).toBe('xhr')
    expect(idempotencyKey(topup)).toBeUndefined()
    expect(topup.postDataJSON()).not.toHaveProperty('idempotency_key')
  })

  test('shows the server end date for a cancelled plan after a reload', async ({
    page
  }) => {
    let cancelled = false
    const routes = await setupRail(page, {
      workspace: workspace('personal', 'owner'),
      billingStatus: () =>
        cancelled
          ? {
              ...ACTIVE_STANDARD_STATUS,
              subscription_status: 'canceled',
              cancel_at: '2099-03-15T10:00:00Z'
            }
          : ACTIVE_STANDARD_STATUS,
      onCancel: () => {
        cancelled = true
      }
    })
    await page.goto(APP_URL)
    await waitForCloudApp(page)

    const cancelDialog = new CancelSubscriptionDialog(page)
    await cancelDialog.open('2099-03-15T10:00:00Z')
    await cancelDialog.confirmCancelButton.click()
    await expect(cancelDialog.root).toBeHidden()
    expect(transport(routes.cancelRequests[0])).toBe('fetch')

    const statusReadsBeforeReload = routes.statusRequests.length
    await page.reload()
    await waitForCloudApp(page)
    const panel = await openPlanAndCredits(page)

    await expect(panel.getByText('Ends on Mar 15, 2099')).toBeVisible()
    await expect(panel.getByText(/Renews on/)).toBeHidden()
    const readsAfterReload = routes.statusRequests.slice(
      statusReadsBeforeReload
    )
    expect(readsAfterReload.length).toBeGreaterThan(0)
    expect(readsAfterReload.map(transport)).not.toContain('xhr')
  })
})

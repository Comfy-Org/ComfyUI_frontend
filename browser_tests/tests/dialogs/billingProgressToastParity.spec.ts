import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
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
 * The progress toasts a pending billing operation raises, held equal across
 * the legacy flow and the SDK rails. The rails swap the transport and the store
 * that watches an operation settle, so a toast the legacy poller raised is
 * easy to lose on the other side without any value on screen changing.
 * Every row runs once per rail and asserts the same thing.
 */
interface Rails {
  subscription: boolean
  topup: boolean
}

const RAIL_MATRIX = [
  { name: 'legacy', rails: { subscription: false, topup: false } },
  { name: 'SDK', rails: { subscription: true, topup: true } }
] as const satisfies readonly { name: string; rails: Rails }[]

const OPERATION_ID = 'op-e2e-progress-toast'
const HOSTED_PAYMENT_URL =
  'https://checkout.stripe.example/pay/op-e2e-progress-toast'

const SUBSCRIPTION_PROCESSING =
  'Processing payment — setting up your workspace...'
const SUBSCRIPTION_ACTION_REQUIRED =
  'Verify your payment to finish setting up your workspace'
const TOPUP_PROCESSING = 'Processing payment — adding credits...'

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

const PLAN_CATALOG = {
  current_plan_slug: 'standard-annual',
  plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const UPGRADE_QUOTE = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: CREATOR_ANNUAL_PLAN.price_cents,
  cost_next_period_cents: CREATOR_ANNUAL_PLAN.price_cents,
  credits_today_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  credits_next_period_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const ACTIVE_STANDARD = {
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

const SAVED_CARD = {
  id: 'pm_e2e_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

const PROCESSING_OPERATION = {
  id: OPERATION_ID,
  status: 'pending',
  started_at: '2026-09-21T00:00:00Z'
} satisfies BillingOpStatusResponse

const VERIFICATION_OPERATION = {
  ...PROCESSING_OPERATION,
  action_url: HOSTED_PAYMENT_URL
} satisfies BillingOpStatusResponse

const SETTLED_OPERATION = {
  id: OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-21T00:00:00Z',
  completed_at: '2026-09-21T00:00:05Z'
} satisfies BillingOpStatusResponse

/** A stand-in backend whose next read reflects what the test moved it to. */
interface BillingServer {
  status: BillingStatusResponse
  operation: BillingOpStatusResponse
}

interface ToastSetup {
  rails: Rails
  status?: BillingStatusResponse
  operation?: BillingOpStatusResponse
  subscribeResponse?: SubscribeResponse
  topupResponse?: CreateTopupResponse
}

async function setupToastParity(
  page: Page,
  {
    rails,
    status = ACTIVE_STANDARD,
    operation = PROCESSING_OPERATION,
    subscribeResponse = {
      billing_op_id: OPERATION_ID,
      status: 'pending_payment'
    },
    topupResponse = {
      billing_op_id: OPERATION_ID,
      topup_id: 'topup-e2e',
      status: 'pending',
      amount_cents: 5_000
    }
  }: ToastSetup
): Promise<BillingServer> {
  const ws = workspace('personal', 'owner')
  const server: BillingServer = { status, operation }

  // A hosted page is an external origin; the truthy return keeps the
  // popup-blocked warning out of rows that are about the progress toast.
  await page.addInitScript(() => {
    window.open = () => window
  })

  await setupCloudApp(page, {
    workspace: ws,
    members: [
      member({
        email: CLOUD_SELF_EMAIL,
        role: 'owner',
        is_original_owner: true
      })
    ],
    features: {
      billing_control_enabled: true,
      unified_cloud_auth: true,
      billing_sdk_subscription_enabled: rails.subscription,
      billing_sdk_topup_enabled: rails.topup
    } satisfies RemoteConfig,
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  await new FeatureFlagHelper(page).seedServerFlags({
    billing_sdk_subscription_enabled: rails.subscription,
    billing_sdk_topup_enabled: rails.topup
  })

  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(server.status))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(PLAN_CATALOG))
  )
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([SAVED_CARD]))
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(UPGRADE_QUOTE))
  )
  await page.route('**/api/billing/subscribe', (route) =>
    route.fulfill(jsonRoute(subscribeResponse))
  )
  await page.route('**/api/billing/subscription/cancel', (route) =>
    route.fulfill(jsonRoute({ billing_op_id: OPERATION_ID, status: 'pending' }))
  )
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill(jsonRoute(topupResponse))
  })
  await page.route('**/api/billing/ops/**', (route) =>
    route.fulfill(jsonRoute(server.operation))
  )

  return server
}

/** A customer coming back to this tab, which wakes the SDK's poll. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

async function confirmCreatorUpgrade(page: Page) {
  await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Confirm your upgrade' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()
}

const successHeading = (page: Page) =>
  page.getByRole('heading', { name: "You're all set" })

test.describe('Billing progress toast parity', { tag: '@cloud' }, () => {
  for (const { name, rails } of RAIL_MATRIX) {
    test.describe(`on the ${name} rail`, () => {
      test('announces a processing subscribe and clears it once it settles', async ({
        page
      }) => {
        const server = await setupToastParity(page, { rails })

        await confirmCreatorUpgrade(page)
        const toast = page.getByText(SUBSCRIPTION_PROCESSING)
        await expect(toast).toBeVisible()

        server.operation = SETTLED_OPERATION
        await returnToTab(page)

        await expect(successHeading(page)).toBeVisible()
        await expect(toast).toBeHidden()
      })

      test('asks for verification while a subscribe waits on the hosted payment page', async ({
        page
      }) => {
        await setupToastParity(page, {
          rails,
          operation: VERIFICATION_OPERATION,
          subscribeResponse: {
            billing_op_id: OPERATION_ID,
            status: 'needs_payment_method',
            payment_method_url: HOSTED_PAYMENT_URL
          }
        })

        await confirmCreatorUpgrade(page)

        await expect(page.getByText(SUBSCRIPTION_ACTION_REQUIRED)).toBeVisible()
        await expect(page.getByText(SUBSCRIPTION_PROCESSING)).toBeHidden()
      })

      test('asks again for verification after a reload finds the subscribe still waiting', async ({
        page
      }) => {
        await setupToastParity(page, {
          rails,
          operation: VERIFICATION_OPERATION,
          status: {
            ...ACTIVE_STANDARD,
            pending_billing_op_id: OPERATION_ID,
            pending_billing_op_type: 'subscription',
            action_url: HOSTED_PAYMENT_URL
          }
        })

        await page.goto(APP_URL)
        await waitForCloudApp(page)

        await expect(page.getByText(SUBSCRIPTION_ACTION_REQUIRED)).toBeVisible()
      })

      test('announces a processing top-up and clears it once it settles', async ({
        page
      }) => {
        const server = await setupToastParity(page, { rails })
        await page.goto(APP_URL)
        await waitForCloudApp(page)

        const dialog = new TopUpCreditsDialog(page)
        await dialog.open()
        await dialog.root
          .getByRole('button', { name: 'Add credits', exact: true })
          .click()
        await dialog.root.getByRole('button', { name: 'Pay $50.00' }).click()
        const toast = page.getByText(TOPUP_PROCESSING)
        await expect(toast).toBeVisible()

        server.operation = SETTLED_OPERATION
        await returnToTab(page)

        await expect(toast).toBeHidden()
      })

      test('raises no progress toast for a cancel', async ({ page }) => {
        await setupToastParity(page, { rails, operation: SETTLED_OPERATION })
        await page.goto(APP_URL)
        await waitForCloudApp(page)

        const cancel = new CancelSubscriptionDialog(page)
        await cancel.open(ACTIVE_STANDARD.renewal_date)
        await cancel.confirmCancelButton.click()
        await expect(cancel.root).toBeHidden()

        await expect(page.getByText(/Processing payment/)).toHaveCount(0)
      })
    })
  }
})

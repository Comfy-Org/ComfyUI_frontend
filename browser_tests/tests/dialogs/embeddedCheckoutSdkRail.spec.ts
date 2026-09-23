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
import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

/**
 * Embedded checkout (`embedded_checked_enabled`) on a workspace that is on the
 * Stripe billing rail.
 *
 * The card form and the in-page bank step are gated on
 * `VITE_STRIPE_PUBLISHABLE_KEY` as well as the flag, so the rows that use
 * `installFakeStripe` need a build with a placeholder key; without one the app
 * never loads Stripe.js. The saved-card rows run either way.
 */
const OPERATION_ID = 'op-e2e-embedded'

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

const PLANS = { plans: [CREATOR_ANNUAL_PLAN] } satisfies BillingPlansResponse

const FREE_STATUS = {
  is_active: false,
  subscription_tier: 'FREE',
  billing_rail: 'stripe',
  has_funds: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null
} satisfies BillingStatusResponse

const ACTIVE_CREATOR_STATUS = {
  ...FREE_STATUS,
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'CREATOR',
  subscription_duration: 'ANNUAL',
  plan_slug: 'creator-annual',
  billing_status: 'paid',
  renewal_date: '2099-09-21T12:00:00Z'
} satisfies BillingStatusResponse

const NEW_CREATOR_QUOTE = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
  new_plan: CREATOR_ANNUAL_PLAN,
  amount_due_cents: 33_600,
  currency: 'usd',
  payment_method_configuration_id: 'pmc_e2e',
  quote_id: 'quote-e2e-embedded',
  quote_version: 1
} satisfies PreviewSubscribeResponse

const VISA = {
  id: 'pm_e2e_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

const MASTERCARD = {
  id: 'pm_e2e_mastercard',
  type: 'card',
  brand: 'mastercard',
  last4: '4444',
  is_default: false
} satisfies SavedPaymentMethod

const SETTLED_OPERATION = {
  id: OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-21T00:00:00Z',
  completed_at: '2026-09-21T00:00:05Z'
} satisfies BillingOpStatusResponse

const BANK_STEP_SECRET = 'pi_e2e_secret_first'
const RETRY_SECRET = 'pi_e2e_secret_retry'
const PROVIDER_PAGE = 'https://pay.stripe.example/authorize/op-e2e-embedded'

/** The server waiting on the customer's bank for this client secret. */
function awaitingBankStep(
  clientSecret: string,
  actionUrl?: string
): BillingOpStatusResponse {
  return {
    id: OPERATION_ID,
    status: 'pending',
    phase: 'awaiting_invoice_payment',
    authentication_state: 'requires_action',
    payment_intent_client_secret: clientSecret,
    ...(actionUrl && { action_url: actionUrl }),
    started_at: '2026-09-21T00:00:00Z'
  }
}

/** What every run below must end with, whichever flag or rail served it. */
const EXPECTED_CHARGE = '$336.00'
const EXPECTED_PLAN_SLUG = 'creator-annual'

/**
 * Stands in for the Stripe.js script `@stripe/stripe-js` injects, with only
 * what the app calls: Elements for the card form, a confirmation token, and
 * `handleNextAction` for the in-page bank step. Every call is reported to the
 * test through `__e2eStripe`, which also answers how the bank step ends.
 */
const FAKE_STRIPE_JS = `(() => {
  const report = (call) => window.__e2eStripe(call)
  function element(type) {
    return {
      mount(target) {
        const node = document.createElement('div')
        node.dataset.testid = 'stripe-' + type + '-element'
        node.textContent = 'Stripe ' + type + ' element'
        target.append(node)
      },
      on(event, handler) {
        if (event === 'ready') setTimeout(() => handler({}), 0)
      },
      destroy() {}
    }
  }
  function Stripe(key) {
    void report({ method: 'Stripe', key })
    return {
      elements(options) {
        void report({ method: 'elements', amount: options.amount, currency: options.currency })
        return {
          create: (type) => element(type),
          submit: async () => ({}),
          update: async () => ({})
        }
      },
      async createConfirmationToken() {
        await report({ method: 'createConfirmationToken' })
        return { confirmationToken: { id: 'ctoken_e2e' } }
      },
      async handleNextAction({ clientSecret }) {
        const outcome = await report({ method: 'handleNextAction', clientSecret })
        if (outcome === 'hang') return new Promise(() => {})
        if (outcome === 'fail') {
          return {
            error: {
              type: 'card_error',
              code: 'payment_intent_authentication_failure',
              message: 'We are unable to authenticate your payment method.'
            }
          }
        }
        return { paymentIntent: { status: 'succeeded' } }
      }
    }
  }
  Stripe.version = 'dahlia'
  window.Stripe = Stripe
})()`

type BankStepOutcome = 'succeed' | 'fail' | 'hang'

interface StripeCall {
  readonly method: string
  readonly clientSecret?: string
  readonly amount?: number
}

interface FakeStripe {
  readonly calls: StripeCall[]
  readonly scriptRequests: Request[]
  /** How each bank step ends, in the order the app starts them. */
  readonly bankSteps: BankStepOutcome[]
  /** Runs when a bank step the fake completed returns to the app. */
  onBankStepCompleted?: () => void
}

async function installFakeStripe(page: Page): Promise<FakeStripe> {
  const fake: FakeStripe = { calls: [], scriptRequests: [], bankSteps: [] }
  await page.exposeFunction('__e2eStripe', (call: StripeCall) => {
    fake.calls.push(call)
    if (call.method !== 'handleNextAction') return undefined
    const outcome = fake.bankSteps.shift() ?? 'succeed'
    if (outcome === 'succeed') fake.onBankStepCompleted?.()
    return outcome
  })
  await page.route('https://js.stripe.com/**', (route) => {
    fake.scriptRequests.push(route.request())
    return route.fulfill({
      contentType: 'application/javascript',
      body: FAKE_STRIPE_JS
    })
  })
  return fake
}

const bankSteps = (fake: FakeStripe) =>
  fake.calls.filter((call) => call.method === 'handleNextAction')

interface CheckoutSetup {
  embedded: boolean
  subscriptionRail: boolean
  topupRail?: boolean
  billingRail?: BillingStatusResponse['billing_rail']
  savedMethods?: SavedPaymentMethod[]
  subscribeResponse?: SubscribeResponse
}

/** What the mocked backend answers; tests move it as the payment progresses. */
interface CheckoutServer {
  subscribed: boolean
  operation: BillingOpStatusResponse
  /** The operation the status read names as still open, if any. */
  pending?: Pick<
    BillingStatusResponse,
    | 'pending_billing_op_id'
    | 'pending_billing_op_type'
    | 'payment_intent_client_secret'
  >
}

interface CheckoutRoutes {
  readonly server: CheckoutServer
  readonly subscribeRequests: Request[]
  readonly topupRequests: Request[]
  /** Every URL the app handed to `window.open`, in order. */
  openedUrls: () => Promise<string[]>
}

async function setupCheckout(
  page: Page,
  {
    embedded,
    subscriptionRail,
    topupRail = false,
    billingRail = 'stripe',
    savedMethods = [VISA],
    subscribeResponse = { billing_op_id: OPERATION_ID, status: 'subscribed' }
  }: CheckoutSetup
): Promise<CheckoutRoutes> {
  const ws = workspace('personal', 'owner')
  const server: CheckoutServer = {
    subscribed: false,
    operation: SETTLED_OPERATION
  }
  const subscribeRequests: Request[] = []
  const topupRequests: Request[] = []

  // Recorded rather than performed: a provider page is an external origin.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__openedUrls', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })

  const flags = {
    embedded_checked_enabled: embedded,
    billing_sdk_subscription_enabled: subscriptionRail,
    billing_sdk_topup_enabled: topupRail
  }
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
      ...flags
    } satisfies RemoteConfig,
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  await new FeatureFlagHelper(page).seedServerFlags(flags)

  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(
      jsonRoute({
        ...(server.subscribed ? ACTIVE_CREATOR_STATUS : FREE_STATUS),
        billing_rail: billingRail,
        ...server.pending
      })
    )
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({
        ...PLANS,
        ...(server.subscribed && { current_plan_slug: 'creator-annual' })
      })
    )
  )
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute(savedMethods))
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(NEW_CREATOR_QUOTE))
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    if (subscribeResponse.status === 'subscribed') server.subscribed = true
    return route.fulfill(jsonRoute(subscribeResponse))
  })
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    topupRequests.push(route.request())
    return route.fulfill(
      jsonRoute({
        billing_op_id: OPERATION_ID,
        topup_id: OPERATION_ID,
        status: 'pending',
        amount_cents: 5_000
      } satisfies CreateTopupResponse)
    )
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) =>
    route.fulfill(jsonRoute(server.operation))
  )

  return {
    server,
    subscribeRequests,
    topupRequests,
    openedUrls: () =>
      page.evaluate(() => [
        ...(window as unknown as { __openedUrls: string[] }).__openedUrls
      ])
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

async function openCreatorCheckout(page: Page) {
  await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
}

const totalDueToday = (page: Page) =>
  page.getByText('Total due today').locator('xpath=..')

const successHeading = (page: Page) =>
  page.getByRole('heading', { name: "You're all set" })

/** Settings ▸ Workspace ▸ Plan & Credits, after a reload. */
async function reloadAndOpenPlanAndCredits(page: Page) {
  await page.reload()
  await waitForCloudApp(page)
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

async function expectCreatorActiveInSettings(page: Page) {
  const panel = await reloadAndOpenPlanAndCredits(page)
  await expect(
    panel.getByRole('heading', { name: 'Creator Yearly' })
  ).toBeVisible()
  await expect(panel.getByText('Renews on Sep 21, 2099')).toBeVisible()
}

test.describe('Embedded checkout', { tag: '@cloud' }, () => {
  test('lists the saved cards and charges the one chosen', async ({ page }) => {
    const routes = await setupCheckout(page, {
      embedded: true,
      subscriptionRail: true,
      savedMethods: [VISA, MASTERCARD]
    })
    await openCreatorCheckout(page)

    const selector = page.getByRole('combobox')
    await expect(selector).toHaveText('visa •••• 4242')
    await selector.click()
    await expect(page.getByRole('option')).toHaveText([
      'visa •••• 4242',
      'mastercard •••• 4444',
      'Add new payment method'
    ])
    await page.getByRole('option', { name: 'mastercard •••• 4444' }).click()
    await expect(selector).toHaveText('mastercard •••• 4444')
    await page.getByRole('button', { name: 'Pay and subscribe' }).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    const body = issued.postDataJSON()
    expect(body).toMatchObject({
      plan_slug: EXPECTED_PLAN_SLUG,
      saved_payment_method_id: MASTERCARD.id
    })
    expect(body).not.toHaveProperty('confirmation_token')
    await expectCreatorActiveInSettings(page)
  })

  test('baseline with embedded checkout off: same plan, charge, and end state as the embedded run', async ({
    page
  }) => {
    const routes = await setupCheckout(page, {
      embedded: false,
      subscriptionRail: true
    })
    await openCreatorCheckout(page)

    await expect(totalDueToday(page)).toContainText(EXPECTED_CHARGE)
    await page.getByRole('button', { name: 'Subscribe to Creator' }).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(transport(issued)).toBe('fetch')
    expect(issued.postDataJSON()).toMatchObject({
      plan_slug: EXPECTED_PLAN_SLUG
    })
    await expectCreatorActiveInSettings(page)
  })

  test('with embedded checkout on the subscription rail: same plan, charge, and end state as the baseline', async ({
    page
  }) => {
    const routes = await setupCheckout(page, {
      embedded: true,
      subscriptionRail: true
    })
    await openCreatorCheckout(page)

    await expect(totalDueToday(page)).toContainText(EXPECTED_CHARGE)
    await page.getByRole('button', { name: 'Pay and subscribe' }).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(transport(issued)).toBe('fetch')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      plan_slug: EXPECTED_PLAN_SLUG,
      saved_payment_method_id: VISA.id
    })
    await expectCreatorActiveInSettings(page)
  })

  test('with embedded checkout on and the subscription rail off: same plan, card, charge, and end state on the legacy client', async ({
    page
  }) => {
    const routes = await setupCheckout(page, {
      embedded: true,
      subscriptionRail: false
    })
    await openCreatorCheckout(page)

    await expect(totalDueToday(page)).toContainText(EXPECTED_CHARGE)
    await page.getByRole('button', { name: 'Pay and subscribe' }).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(transport(issued)).toBe('xhr')
    expect(idempotencyKey(issued)).toBeUndefined()
    expect(issued.postDataJSON()).toMatchObject({
      plan_slug: EXPECTED_PLAN_SLUG,
      saved_payment_method_id: VISA.id
    })
    await expectCreatorActiveInSettings(page)
  })
})

test.describe(
  'Embedded checkout card form and bank step',
  { tag: '@cloud' },
  () => {
    test('renders the card form in the app and subscribes with its token on fetch', async ({
      page
    }) => {
      const fake = await installFakeStripe(page)
      const routes = await setupCheckout(page, {
        embedded: true,
        subscriptionRail: true,
        savedMethods: []
      })
      await openCreatorCheckout(page)

      await expect(page.getByTestId('stripe-payment-element')).toBeVisible()
      await expect(page.getByTestId('stripe-address-element')).toBeVisible()
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      await expect(successHeading(page)).toBeVisible()
      expect(routes.subscribeRequests).toHaveLength(1)
      const [issued] = routes.subscribeRequests
      expect(transport(issued)).toBe('fetch')
      expect(idempotencyKey(issued)).toBeTruthy()
      const body = issued.postDataJSON()
      expect(body).toMatchObject({
        plan_slug: EXPECTED_PLAN_SLUG,
        confirmation_token: 'ctoken_e2e'
      })
      expect(body).not.toHaveProperty('saved_payment_method_id')
      expect(fake.calls).toContainEqual({
        method: 'elements',
        amount: 33_600,
        currency: 'usd'
      })
      expect(await routes.openedUrls()).toEqual([])
    })

    test('runs the bank step in the page, activates the plan, and Settings agrees after a reload', async ({
      page
    }) => {
      const fake = await installFakeStripe(page)
      const routes = await setupCheckout(page, {
        embedded: true,
        subscriptionRail: true,
        savedMethods: [],
        subscribeResponse: {
          billing_op_id: OPERATION_ID,
          status: 'pending_payment'
        }
      })
      routes.server.operation = awaitingBankStep(BANK_STEP_SECRET)
      fake.onBankStepCompleted = () => {
        routes.server.subscribed = true
        routes.server.operation = SETTLED_OPERATION
      }
      await openCreatorCheckout(page)
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      await expect(successHeading(page)).toBeVisible()
      expect(bankSteps(fake)).toEqual([
        { method: 'handleNextAction', clientSecret: BANK_STEP_SECRET }
      ])
      expect(await routes.openedUrls()).toEqual([])
      expect(routes.subscribeRequests).toHaveLength(1)
      expect(transport(routes.subscribeRequests[0])).toBe('fetch')
      await expectCreatorActiveInSettings(page)
    })

    test('shows a declined bank step with its reason and does not activate the plan', async ({
      page
    }) => {
      const fake = await installFakeStripe(page)
      fake.bankSteps.push('fail')
      const routes = await setupCheckout(page, {
        embedded: true,
        subscriptionRail: true,
        savedMethods: [],
        subscribeResponse: {
          billing_op_id: OPERATION_ID,
          status: 'pending_payment'
        }
      })
      routes.server.operation = awaitingBankStep(BANK_STEP_SECRET)
      await openCreatorCheckout(page)
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      await expect(
        page.getByRole('alert').filter({
          hasText:
            "We couldn't complete payment verification. Please try again."
        })
      ).toBeVisible()
      await expect(successHeading(page)).toBeHidden()
      expect(bankSteps(fake)).toHaveLength(1)
      expect(await routes.openedUrls()).toEqual([])
      expect(routes.subscribeRequests).toHaveLength(1)
    })

    test('sends a workspace off the Stripe rail to the hosted page instead of the bank step', async ({
      page
    }) => {
      const fake = await installFakeStripe(page)
      const routes = await setupCheckout(page, {
        embedded: true,
        subscriptionRail: true,
        billingRail: 'metronome',
        savedMethods: [],
        subscribeResponse: {
          billing_op_id: OPERATION_ID,
          status: 'pending_payment'
        }
      })
      routes.server.operation = awaitingBankStep(
        BANK_STEP_SECRET,
        PROVIDER_PAGE
      )
      await openCreatorCheckout(page)
      await page.getByRole('button', { name: 'Pay and subscribe' }).click()

      await expect.poll(() => routes.openedUrls()).toEqual([PROVIDER_PAGE])
      routes.server.subscribed = true
      routes.server.operation = SETTLED_OPERATION
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))

      await expect(successHeading(page)).toBeVisible()
      expect(bankSteps(fake)).toEqual([])
      expect(await routes.openedUrls()).toEqual([PROVIDER_PAGE])
    })
  }
)

test.describe('Embedded top-up bank step', { tag: '@cloud' }, () => {
  test('offers the in-page bank step again after a decline, and settles when it completes', async ({
    page
  }) => {
    const fake = await installFakeStripe(page)
    fake.bankSteps.push('fail')
    const routes = await setupCheckout(page, {
      embedded: true,
      subscriptionRail: true,
      topupRail: true
    })
    routes.server.subscribed = true
    routes.server.operation = awaitingBankStep(BANK_STEP_SECRET)

    const dialog = new TopUpCreditsDialog(page)
    await page.goto(`${APP_URL}/?topup=1`)
    await expect(dialog.heading).toBeVisible({ timeout: 45_000 })
    await dialog.root
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()
    await dialog.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect(
      dialog.root.getByText(
        "We couldn't complete payment verification. Please try again."
      )
    ).toBeVisible()
    await expect(
      dialog.root.getByRole('button', { name: 'Start over' })
    ).toBeVisible()

    routes.server.operation = awaitingBankStep(RETRY_SECRET)
    fake.onBankStepCompleted = () => {
      routes.server.operation = SETTLED_OPERATION
    }
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await dialog.root
      .getByRole('button', { name: 'Complete verification' })
      .click()

    await expect(
      page
        .locator('.p-toast-message-success')
        .getByText('Credits added successfully')
    ).toBeVisible()
    expect(bankSteps(fake)).toEqual([
      { method: 'handleNextAction', clientSecret: BANK_STEP_SECRET },
      { method: 'handleNextAction', clientSecret: RETRY_SECRET }
    ])
    expect(routes.topupRequests).toHaveLength(1)
    expect(transport(routes.topupRequests[0])).toBe('fetch')
    expect(await routes.openedUrls()).toEqual([])
  })
})

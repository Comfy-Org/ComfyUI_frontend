import { expect } from '@playwright/test'
import type { Locator, Page, Request, Route } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  ErrorResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeRequest,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const PLAN = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 33_600,
  credits_cents: 7_400,
  max_seats: 5,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 33_600,
    total_credits_cents: 7_400
  }
} satisfies Plan

const STATUS = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_status: 'paid',
  has_funds: true,
  team_credit_stop: null,
  billing_rail: 'legacy_stripe'
} satisfies BillingStatusResponse & { billing_rail: 'legacy_stripe' }

const BALANCE = {
  amount_micros: 0,
  currency: 'USD'
} satisfies BillingBalanceResponse

const PLANS = { plans: [PLAN] } satisfies BillingPlansResponse

function quote(code?: string, version = 1): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-08-09T00:00:00Z',
    is_immediate: true,
    cost_today_cents: code === 'SAVE20' ? 26_880 : 33_600,
    cost_next_period_cents: 33_600,
    credits_today_cents: 7_400,
    credits_next_period_cents: 7_400,
    new_plan: PLAN,
    quote_id: `quote-${code ?? 'base'}-${version}`,
    quote_version: version,
    promotion_code: code,
    discounts: code
      ? [{ kind: 'promotion', code, amount_off_cents: 6_720 }]
      : [],
    amount_due_cents: code === 'SAVE20' ? 26_880 : 33_600,
    currency: 'usd',
    renewal_amount_cents: 33_600,
    renewal_at: '2027-08-09T00:00:00Z',
    payment_method_configuration_id: 'pmc_mock_checkout'
  }
}

function operation(
  id: string,
  status: BillingOpStatusResponse['status'],
  extra: Partial<BillingOpStatusResponse> = {}
): BillingOpStatusResponse {
  return {
    id,
    status,
    started_at: '2026-08-09T00:00:00Z',
    ...extra
  }
}

export class BillingCheckoutStateMachineHelper {
  readonly subscribeRequests: Request[] = []
  readonly previewRequests: Request[] = []
  readonly operationRequests: Request[] = []
  readonly subscribeButton: Locator
  readonly verificationButton: Locator
  readonly successHeading: Locator

  constructor(readonly page: Page) {
    this.subscribeButton = page.getByRole('button', {
      name: /Pay and subscribe|Subscribe to Creator/
    })
    this.verificationButton = page.getByRole('button', {
      name: 'Complete verification'
    })
    this.successHeading = page.getByRole('heading', {
      name: "You're all set"
    })
  }

  async boot() {
    await mockCloudBoot(this.page, {
      features: {
        billing_control_enabled: true,
        consolidated_billing_enabled: true
      } satisfies RemoteConfig,
      settings: {
        'Comfy.Assets.UseAssetAPI': false,
        'Comfy.TutorialCompleted': true
      }
    })
    await this.page.route('**/api/settings/**', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(jsonRoute({}))
        : route.fallback()
    )
    await this.page.route('**/api/prompt', (route) =>
      route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
    )
    await this.page.route('**/api/queue', (route) =>
      route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
    )
    await mockBilling(this.page)
    await this.page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(STATUS))
    )
    await this.page.route('**/api/billing/balance', (route) =>
      route.fulfill(jsonRoute(BALANCE))
    )
    await this.page.route('**/api/billing/plans', (route) =>
      route.fulfill(jsonRoute(PLANS))
    )
    await bootCloud(this.page)
  }

  async openCheckout() {
    await this.page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
    await expect(
      this.page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeVisible()
  }

  async mockPreview(handler: (route: Route, index: number) => Promise<void>) {
    await this.page.route('**/api/billing/preview-subscribe', async (route) => {
      this.previewRequests.push(route.request())
      await handler(route, this.previewRequests.length)
    })
  }

  async mockDefaultPreview() {
    await this.mockPreview((route) => route.fulfill(jsonRoute(quote())))
  }

  async mockSubscribe(response: SubscribeResponse) {
    await this.page.route('**/api/billing/subscribe', (route) => {
      this.subscribeRequests.push(route.request())
      return route.fulfill(jsonRoute(response))
    })
  }

  async mockSubscribeSequence(responses: SubscribeResponse[]) {
    await this.page.route('**/api/billing/subscribe', (route) => {
      this.subscribeRequests.push(route.request())
      const index = Math.min(
        this.subscribeRequests.length - 1,
        responses.length - 1
      )
      return route.fulfill(jsonRoute(responses[index]))
    })
  }

  async mockOperation(id: string, responses: BillingOpStatusResponse[]) {
    await this.page.route(`**/api/billing/ops/${id}`, (route) => {
      this.operationRequests.push(route.request())
      const index = Math.min(
        this.operationRequests.length - 1,
        responses.length - 1
      )
      return route.fulfill(jsonRoute(responses[index]))
    })
  }

  async installStripeBoundary() {
    await this.page.addInitScript(() => {
      const root = document.documentElement
      Object.defineProperty(window, 'Stripe', {
        configurable: true,
        value: () => ({
          elements: () => ({
            create: () => ({
              mount: () => undefined,
              on: () => undefined,
              destroy: () => undefined
            }),
            submit: async () => ({})
          }),
          createConfirmationToken: async () => {
            const count = Number(root.dataset.confirmationTokenCount ?? '0') + 1
            root.dataset.confirmationTokenCount = String(count)
            return { confirmationToken: { id: `ct_mock_${count}` } }
          },
          handleNextAction: async () => ({
            paymentIntent: { status: 'succeeded' }
          })
        })
      })
    })
    await this.page.route('https://js.stripe.com/v3/**', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: '' })
    )
  }

  async installHostedActionBoundary() {
    await this.page.addInitScript(() => {
      window.open = () => {
        const root = document.documentElement
        const count = Number(root.dataset.hostedActionCount ?? '0') + 1
        root.dataset.hostedActionCount = String(count)
        window.dispatchEvent(new Event('focus'))
        return window
      }
    })
  }

  async hostedActionCount() {
    return Number(
      (await this.page
        .locator('html')
        .getAttribute('data-hosted-action-count')) ?? '0'
    )
  }

  async confirmationTokenCount() {
    return Number(
      (await this.page
        .locator('html')
        .getAttribute('data-confirmation-token-count')) ?? '0'
    )
  }

  subscribeBody(index = 0): SubscribeRequest {
    return this.subscribeRequests[index].postDataJSON()
  }

  static quote = quote
  static operation = operation

  static subscribeResponse(
    billing_op_id: string,
    status: SubscribeResponse['status']
  ): SubscribeResponse {
    return { billing_op_id, status, effective_at: '2026-08-09T00:00:00Z' }
  }

  static error(message: string): ErrorResponse {
    return { code: 'checkout_failed', message }
  }
}

import type { Locator, Page, Request, TestInfo } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  Plan,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import { gotoCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

type OperationResponse = BillingOpStatusResponse | { status: number }

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const FEATURES = {
  billing_control_enabled: true,
  consolidated_billing_enabled: true,
  firebase_env: 'dev'
} satisfies RemoteConfig

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

const PLANS = {
  plans: [PLAN]
} satisfies BillingPlansResponse

const QUOTE = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2099-01-01T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
  new_plan: PLAN,
  quote_id: 'quote-1',
  quote_version: 1,
  discounts: [],
  amount_due_cents: 33_600,
  currency: 'usd',
  renewal_amount_cents: 33_600,
  renewal_at: '2100-01-01T00:00:00Z'
} satisfies PreviewSubscribeResponse

const STATUS = {
  billing_rail: 'metronome',
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  has_funds: true,
  billing_status: 'inactive',
  subscription_status: 'ended',
  team_credit_stop: null
} satisfies BillingStatusResponse

const TOPUP = {
  billing_op_id: 'topup-server-routed',
  topup_id: 'topup-server-routed',
  status: 'completed',
  amount_cents: 5_000
} satisfies CreateTopupResponse

const BALANCE = {
  amount_micros: 0,
  currency: 'USD'
} satisfies BillingBalanceResponse

export class BillingCheckoutStateMachineHelper {
  readonly confirmHeading: Locator
  readonly payButton: Locator
  readonly promoInput: Locator
  readonly applyPromoButton: Locator
  readonly requests: Array<Record<string, unknown>> = []
  readonly responses: Array<Record<string, unknown>> = []

  private subscribeResponses: SubscribeResponse[] = []
  private operationResponses = new Map<string, OperationResponse[]>()
  private previewResponses: PreviewSubscribeResponse[] = []
  private previewCount = 0
  private shouldFailNextStripeAction = false

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo
  ) {
    this.confirmHeading = page.getByRole('heading', {
      name: 'Confirm your payment'
    })
    this.payButton = page.getByRole('button', {
      name: 'Pay and subscribe'
    })
    this.promoInput = page.getByPlaceholder('Promo code')
    this.applyPromoButton = page.getByRole('button', { name: 'Apply' })
  }

  async setup() {
    await this.page.context().routeWebSocket(/\/ws/, (socket) => {
      socket.send(
        JSON.stringify({
          type: 'status',
          data: { status: { exec_info: { queue_remaining: 0 } } }
        })
      )
    })
    await this.page.addInitScript(() => {
      window.__COMFY_E2E_STRIPE_PUBLISHABLE_KEY__ = 'pk_test_billing_e2e'
    })
    await this.page.route('https://js.stripe.com/**', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.Stripe = function () {
          return {
            handleNextAction: async function () {
              window.__billingE2eActionCalls = (window.__billingE2eActionCalls || 0) + 1;
              if (sessionStorage.getItem('billingE2eFailNextAction')) {
                sessionStorage.removeItem('billingE2eFailNextAction');
                return { error: { message: 'Verification was interrupted' } };
              }
              return {};
            }
          };
        };`
      })
    )
    await mockCloudBoot(this.page, {
      features: FEATURES,
      settings: {
        'Comfy.Assets.UseAssetAPI': false,
        'Comfy.TutorialCompleted': true
      }
    })
    await this.mockGraphBoot()
    await mockBilling(this.page)
    await mockWorkspace(this.page, workspace('personal', 'owner'), [])
    await bootCloud(this.page)
    await this.installBillingRoutes()
  }

  queueSubscribe(...responses: SubscribeResponse[]) {
    this.subscribeResponses.push(...responses)
  }

  queueOperation(opId: string, ...responses: OperationResponse[]) {
    this.operationResponses.set(opId, responses)
  }

  queuePreview(...responses: PreviewSubscribeResponse[]) {
    this.previewResponses.push(...responses)
  }

  async openCheckout() {
    await gotoCloudApp(this.page, APP_URL)
    await this.page.evaluate(async () => {
      const authStorePath = '/src/stores/authStore.ts'
      const workspaceStorePath =
        '/src/platform/workspace/stores/teamWorkspaceStore.ts'
      const [{ useAuthStore }, { useTeamWorkspaceStore }] = await Promise.all([
        import(authStorePath),
        import(workspaceStorePath)
      ])
      useAuthStore().getAuthHeaderOrThrow = async () => ({
        Authorization: 'Bearer billing-e2e-token'
      })
      const workspaceStore = useTeamWorkspaceStore()
      await workspaceStore.initialize()
    })
    await this.page.getByRole('button', { name: 'Current user' }).click()
    await this.page.getByTestId('plans-pricing-menu-item').click()
    await this.page
      .getByRole('button', { name: 'Subscribe to Creator Yearly' })
      .click()
    await this.confirmHeading.waitFor({ state: 'visible' })
    if (this.shouldFailNextStripeAction) {
      await this.page.evaluate(() => {
        sessionStorage.setItem('billingE2eFailNextAction', '1')
      })
      this.shouldFailNextStripeAction = false
    }
  }

  failNextStripeAction() {
    this.shouldFailNextStripeAction = true
  }

  operationPollCount(opId: string) {
    return this.requests.filter(
      (request) => request.path === `/api/billing/ops/${opId}`
    ).length
  }

  subscribeCount() {
    return this.requests.filter(
      (request) => request.path === '/api/billing/subscribe'
    ).length
  }

  requestCount(path: string) {
    return this.requests.filter((request) => request.path === path).length
  }

  async topupAfterStaleRail() {
    await this.openCheckout()
    return this.page.evaluate(async () => {
      const authStorePath = '/src/stores/authStore.ts'
      const billingContextPath = '/src/composables/billing/useBillingContext.ts'
      const workspaceBillingPath =
        '/src/platform/workspace/composables/useWorkspaceBilling.ts'
      const workspaceStorePath =
        '/src/platform/workspace/stores/teamWorkspaceStore.ts'
      const [
        { useAuthStore },
        { useBillingContext },
        { useWorkspaceBilling },
        { useTeamWorkspaceStore }
      ] = await Promise.all([
        import(authStorePath),
        import(billingContextPath),
        import(workspaceBillingPath),
        import(workspaceStorePath)
      ])
      useAuthStore().getAuthHeaderOrThrow = async () => ({
        Authorization: 'Bearer billing-e2e-token'
      })
      const workspaceStore = useTeamWorkspaceStore()
      const workspaceId = workspaceStore.activeWorkspace?.id
      if (!workspaceId) throw new Error('No active workspace')

      workspaceStore.setWorkspaceBillingRail(workspaceId, 'legacy_stripe')
      await useWorkspaceBilling().fetchStatus()
      const billing = useBillingContext()
      const response = await billing.topup(5_000)

      return {
        billingRail: workspaceStore.activeWorkspaceBillingRail,
        billingType: billing.type.value,
        response
      }
    })
  }

  async attachEvidence() {
    await this.testInfo.attach('billing-network-evidence.json', {
      body: JSON.stringify(
        { requests: this.requests, responses: this.responses },
        null,
        2
      ),
      contentType: 'application/json'
    })
  }

  private async mockGraphBoot() {
    await this.page.route('**/api/settings/**', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(jsonRoute({}))
        : route.fallback()
    )
    await this.page.route('**/api/prompt', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
        : route.fallback()
    )
    await this.page.route('**/api/queue', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
        : route.fallback()
    )
    await this.page.route('**/api/experiment/models', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(jsonRoute([]))
        : route.fallback()
    )
    await this.page.route('**/api/jobs?*', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill(
            jsonRoute({
              jobs: [],
              pagination: {
                offset: 0,
                limit: Number(
                  new URL(route.request().url()).searchParams.get('limit') ??
                    200
                ),
                total: 0,
                has_more: false
              }
            })
          )
        : route.fallback()
    )
  }

  private async installBillingRoutes() {
    await this.page.route('**/api/billing/status', (route) =>
      this.fulfill(route.request(), route.fulfill.bind(route), STATUS)
    )
    await this.page.route('**/api/billing/balance', (route) =>
      this.fulfill(route.request(), route.fulfill.bind(route), BALANCE)
    )
    await this.page.route('**/api/billing/plans', (route) =>
      this.fulfill(route.request(), route.fulfill.bind(route), PLANS)
    )
    await this.page.route('**/api/billing/payment-methods', (route) =>
      this.fulfill(route.request(), route.fulfill.bind(route), [
        {
          id: 'pm_saved',
          type: 'card',
          brand: 'visa',
          last4: '4242',
          is_default: true
        }
      ])
    )
    await this.page.route('**/api/billing/preview-subscribe', (route) => {
      const response =
        this.previewCount++ === 0
          ? QUOTE
          : (this.previewResponses.shift() ?? QUOTE)
      return this.fulfill(route.request(), route.fulfill.bind(route), response)
    })
    await this.page.route('**/api/billing/subscribe', (route) => {
      const response = this.subscribeResponses.shift()
      if (!response) throw new Error('No queued subscribe response')
      return this.fulfill(route.request(), route.fulfill.bind(route), response)
    })
    await this.page.route('**/api/billing/topup', (route) =>
      this.fulfill(route.request(), route.fulfill.bind(route), TOPUP)
    )
    await this.page.route('**/customers/credit', (route) =>
      this.fulfill(
        route.request(),
        route.fulfill.bind(route),
        { message: 'legacy top-up must not be called' },
        409
      )
    )
    await this.page.route('**/api/billing/ops/*', (route) => {
      const opId = route.request().url().split('/').at(-1) ?? ''
      const queue = this.operationResponses.get(opId)
      return this.operationResponse(queue).then((response) => {
        if (!response) throw new Error(`No queued status for ${opId}`)
        if ('status' in response && typeof response.status === 'number') {
          return this.fulfill(
            route.request(),
            route.fulfill.bind(route),
            { message: 'temporary poll failure' },
            response.status
          )
        }
        return this.fulfill(
          route.request(),
          route.fulfill.bind(route),
          response
        )
      })
    })
  }

  private async operationResponse(queue: OperationResponse[] | undefined) {
    const first = queue?.[0]
    if (
      queue?.length === 2 &&
      first &&
      'authentication_state' in first &&
      first.authentication_state === 'requires_action'
    ) {
      const actionCalls = await this.page.evaluate(
        () => window.__billingE2eActionCalls ?? 0
      )
      return actionCalls < 2 ? first : queue[1]
    }

    const response = queue?.length === 1 ? queue[0] : queue?.shift()
    return response
  }

  private async fulfill(
    request: Request,
    send: (response: ReturnType<typeof jsonRoute>) => Promise<void>,
    body: unknown,
    status = 200
  ) {
    const path = new URL(request.url()).pathname
    this.requests.push({
      method: request.method(),
      path,
      body: request.postData() ? (request.postDataJSON() as unknown) : null
    })
    this.responses.push({ path, status, body })
    await send({ ...jsonRoute(body), status })
  }
}

declare global {
  interface Window {
    __billingE2eActionCalls?: number
  }
}

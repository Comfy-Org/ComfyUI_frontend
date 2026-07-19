import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  CreateTopupRequest,
  CreateTopupResponse,
  ErrorResponse,
  PreviewSubscribeRequest as GeneratedPreviewSubscribeRequest,
  PreviewSubscribeResponse,
  ResubscribeRequest,
  ResubscribeResponse,
  SubscribeRequest,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import {
  BILLING_RENEWAL_DATE,
  DEFAULT_BILLING_BALANCE,
  DEFAULT_BILLING_PLANS,
  DEFAULT_BILLING_STATUS,
  DEFAULT_CANCEL_RESPONSE,
  DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE,
  DEFAULT_RESUBSCRIBE_RESPONSE,
  DEFAULT_SUBSCRIBE_RESPONSE,
  DEFAULT_TOPUP_RESPONSE,
  SUCCEEDED_BILLING_OPERATION
} from '@e2e/fixtures/data/cloudWorkspace'

const BILLING_ROUTE_PATTERN = '**/api/billing/**'

export type PreviewSubscribeRequest = GeneratedPreviewSubscribeRequest &
  Pick<SubscribeRequest, 'team_credit_stop_id' | 'billing_cycle'>

export interface BillingMutationRequests {
  previewSubscribe: PreviewSubscribeRequest[]
  subscribe: SubscribeRequest[]
  topup: CreateTopupRequest[]
  cancel: CancelSubscriptionRequest[]
  resubscribe: ResubscribeRequest[]
}

export type BillingQuery = 'status' | 'balance' | 'plans'

export interface CloudBillingState {
  status: BillingStatusResponse
  balance: BillingBalanceResponse
  plans: BillingPlansResponse
}

export interface BillingHttpFailure {
  status: number
  message: string
  code?: string
}

export interface CloudBillingSetupOptions {
  status?: BillingStatusResponse
  balance?: BillingBalanceResponse
  plans?: BillingPlansResponse
  previewResponse?: PreviewSubscribeResponse
  subscribeResponse?: SubscribeResponse
  topupResponse?: CreateTopupResponse
  cancelResponse?: CancelSubscriptionResponse
  resubscribeResponse?: ResubscribeResponse
  postSubscribeBalance?: BillingBalanceResponse
  operationResponses?: Record<string, readonly BillingOpStatusResponse[]>
  failures?: Partial<Record<keyof BillingMutationRequests, BillingHttpFailure>>
  queryFailures?: Partial<Record<BillingQuery, BillingHttpFailure>>
}

type PendingMutation =
  | { type: 'subscribe'; request: SubscribeRequest }
  | { type: 'topup'; amountCents: number }
  | { type: 'cancel'; cancelAt: string }
  | { type: 'resubscribe' }

export class CloudBillingApiMock {
  readonly requests: BillingMutationRequests = {
    previewSubscribe: [],
    subscribe: [],
    topup: [],
    cancel: [],
    resubscribe: []
  }
  private _state: CloudBillingState | null = null
  private previewResponse = structuredClone(DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE)
  private subscribeResponse = structuredClone(DEFAULT_SUBSCRIBE_RESPONSE)
  private topupResponse = structuredClone(DEFAULT_TOPUP_RESPONSE)
  private cancelResponse = structuredClone(DEFAULT_CANCEL_RESPONSE)
  private resubscribeResponse = structuredClone(DEFAULT_RESUBSCRIBE_RESPONSE)
  private postSubscribeBalance: BillingBalanceResponse | null = null
  private failures: CloudBillingSetupOptions['failures'] = {}
  private readonly queryFailures = new Map<BillingQuery, BillingHttpFailure>()
  private readonly operationResponses = new Map<
    string,
    readonly BillingOpStatusResponse[]
  >()
  private readonly operationPolls = new Map<string, number>()
  private readonly pendingMutations = new Map<string, PendingMutation>()
  private readonly appliedOperations = new Set<string>()
  private readonly routeHandler: (route: Route) => Promise<void>

  constructor(private readonly page: Page) {
    this.routeHandler = this.handleRoute.bind(this)
  }

  get state(): CloudBillingState {
    if (!this._state) {
      throw new Error('Call billingApi.setup() before reading billing state')
    }
    return this._state
  }

  async setup(
    options: CloudBillingSetupOptions = {}
  ): Promise<CloudBillingState> {
    if (this._state) {
      throw new Error('billingApi.setup() can only be called once per test')
    }

    this._state = {
      status: structuredClone(options.status ?? DEFAULT_BILLING_STATUS),
      balance: structuredClone(options.balance ?? DEFAULT_BILLING_BALANCE),
      plans: structuredClone(options.plans ?? DEFAULT_BILLING_PLANS)
    }
    this.previewResponse = structuredClone(
      options.previewResponse ?? DEFAULT_PREVIEW_SUBSCRIBE_RESPONSE
    )
    this.subscribeResponse = structuredClone(
      options.subscribeResponse ?? DEFAULT_SUBSCRIBE_RESPONSE
    )
    this.topupResponse = structuredClone(
      options.topupResponse ?? DEFAULT_TOPUP_RESPONSE
    )
    this.cancelResponse = structuredClone(
      options.cancelResponse ?? DEFAULT_CANCEL_RESPONSE
    )
    this.resubscribeResponse = structuredClone(
      options.resubscribeResponse ?? DEFAULT_RESUBSCRIBE_RESPONSE
    )
    this.postSubscribeBalance = options.postSubscribeBalance
      ? structuredClone(options.postSubscribeBalance)
      : null
    this.failures = structuredClone(options.failures ?? {})

    for (const [query, failure] of Object.entries(
      options.queryFailures ?? {}
    )) {
      this.queryFailures.set(query as BillingQuery, structuredClone(failure))
    }

    for (const [operationId, responses] of Object.entries(
      options.operationResponses ?? {}
    )) {
      this.operationResponses.set(operationId, structuredClone(responses))
    }

    await this.page.route(BILLING_ROUTE_PATTERN, this.routeHandler)
    return this._state
  }

  setBalance(balance: BillingBalanceResponse): void {
    this.state.balance = structuredClone(balance)
  }

  setQueryFailure(
    query: BillingQuery,
    failure: BillingHttpFailure | null
  ): void {
    if (failure) {
      this.queryFailures.set(query, structuredClone(failure))
      return
    }
    this.queryFailures.delete(query)
  }

  async dispose(): Promise<void> {
    if (!this._state) return
    await this.page.unroute(BILLING_ROUTE_PATTERN, this.routeHandler)
  }

  private async handleRoute(route: Route): Promise<void> {
    const request = route.request()
    const method = request.method().toUpperCase()
    const pathname = new URL(request.url()).pathname

    if (method === 'GET' && pathname.endsWith('/api/billing/status')) {
      await this.handleQuery(route, 'status', this.state.status)
      return
    }
    if (method === 'GET' && pathname.endsWith('/api/billing/balance')) {
      await this.handleQuery(route, 'balance', this.state.balance)
      return
    }
    if (method === 'GET' && pathname.endsWith('/api/billing/plans')) {
      await this.handleQuery(route, 'plans', this.state.plans)
      return
    }
    if (
      method === 'POST' &&
      pathname.endsWith('/api/billing/preview-subscribe')
    ) {
      await this.handlePreviewSubscribe(route)
      return
    }
    if (method === 'POST' && pathname.endsWith('/api/billing/subscribe')) {
      await this.handleSubscribe(route)
      return
    }
    if (method === 'POST' && pathname.endsWith('/api/billing/topup')) {
      await this.handleTopup(route)
      return
    }
    if (
      method === 'POST' &&
      pathname.endsWith('/api/billing/subscription/cancel')
    ) {
      await this.handleCancel(route)
      return
    }
    if (
      method === 'POST' &&
      pathname.endsWith('/api/billing/subscription/resubscribe')
    ) {
      await this.handleResubscribe(route)
      return
    }
    if (method === 'GET' && pathname.includes('/api/billing/ops/')) {
      await this.handleOperation(route, pathname)
      return
    }

    await route.fallback()
  }

  private async handleQuery(
    route: Route,
    query: BillingQuery,
    response:
      | BillingStatusResponse
      | BillingBalanceResponse
      | BillingPlansResponse
  ): Promise<void> {
    const failure = this.queryFailures.get(query)
    if (failure) {
      const body: ErrorResponse = {
        code: failure.code ?? 'billing_mock_error',
        message: failure.message
      }
      await route.fulfill({ status: failure.status, json: body })
      return
    }
    await route.fulfill({ json: response })
  }

  private async handlePreviewSubscribe(route: Route): Promise<void> {
    const request = route.request().postDataJSON() as PreviewSubscribeRequest
    this.requests.previewSubscribe.push(request)
    if (await this.failIfConfigured(route, 'previewSubscribe')) return
    await route.fulfill({ json: this.previewResponse })
  }

  private async handleSubscribe(route: Route): Promise<void> {
    const request = route.request().postDataJSON() as SubscribeRequest
    this.requests.subscribe.push(request)
    if (await this.failIfConfigured(route, 'subscribe')) return

    if (this.subscribeResponse.status === 'subscribed') {
      this.applySubscribe(request)
    } else {
      this.pendingMutations.set(this.subscribeResponse.billing_op_id, {
        type: 'subscribe',
        request
      })
    }
    await route.fulfill({ json: this.subscribeResponse })
  }

  private async handleTopup(route: Route): Promise<void> {
    const request = route.request().postDataJSON() as CreateTopupRequest
    this.requests.topup.push(request)
    if (await this.failIfConfigured(route, 'topup')) return

    const response: CreateTopupResponse = {
      ...this.topupResponse,
      amount_cents: request.amount_cents
    }
    if (response.status === 'completed') {
      this.applyTopup(request.amount_cents)
    } else if (response.status === 'pending') {
      this.pendingMutations.set(response.billing_op_id, {
        type: 'topup',
        amountCents: request.amount_cents
      })
    }
    await route.fulfill({ json: response })
  }

  private async handleCancel(route: Route): Promise<void> {
    const request = route.request().postDataJSON() as CancelSubscriptionRequest
    this.requests.cancel.push(request)
    if (await this.failIfConfigured(route, 'cancel')) return

    this.pendingMutations.set(this.cancelResponse.billing_op_id, {
      type: 'cancel',
      cancelAt: this.cancelResponse.cancel_at
    })
    await route.fulfill({ json: this.cancelResponse })
  }

  private async handleResubscribe(route: Route): Promise<void> {
    const request = route.request().postDataJSON() as ResubscribeRequest
    this.requests.resubscribe.push(request)
    if (await this.failIfConfigured(route, 'resubscribe')) return

    if (this.resubscribeResponse.status === 'active') {
      this.applyResubscribe()
    } else {
      this.pendingMutations.set(this.resubscribeResponse.billing_op_id, {
        type: 'resubscribe'
      })
    }
    await route.fulfill({ json: this.resubscribeResponse })
  }

  private async handleOperation(route: Route, pathname: string): Promise<void> {
    const operationId = decodeURIComponent(pathname.split('/').at(-1) ?? '')
    const responses = this.operationResponses.get(operationId)
    const poll = this.operationPolls.get(operationId) ?? 0
    const configuredResponse = responses?.at(
      Math.min(poll, responses.length - 1)
    )
    const response: BillingOpStatusResponse = {
      ...(configuredResponse ?? SUCCEEDED_BILLING_OPERATION),
      id: operationId
    }
    this.operationPolls.set(operationId, poll + 1)

    if (response.status === 'succeeded') {
      this.applyPendingMutation(operationId)
    }
    await route.fulfill({ json: response })
  }

  private async failIfConfigured(
    route: Route,
    mutation: keyof BillingMutationRequests
  ): Promise<boolean> {
    const failure = this.failures?.[mutation]
    if (!failure) return false

    const body: ErrorResponse = {
      code: failure.code ?? 'billing_mock_error',
      message: failure.message
    }
    await route.fulfill({ status: failure.status, json: body })
    return true
  }

  private applyPendingMutation(operationId: string): void {
    if (this.appliedOperations.has(operationId)) return
    const mutation = this.pendingMutations.get(operationId)
    if (!mutation) return

    if (mutation.type === 'subscribe') this.applySubscribe(mutation.request)
    if (mutation.type === 'topup') this.applyTopup(mutation.amountCents)
    if (mutation.type === 'cancel') this.applyCancel(mutation.cancelAt)
    if (mutation.type === 'resubscribe') this.applyResubscribe()
    this.appliedOperations.add(operationId)
  }

  private applySubscribe(request: SubscribeRequest): void {
    const plan = this.state.plans.plans.find(
      ({ slug }) => slug === request.plan_slug
    )
    const stop = this.state.plans.team_credit_stops?.stops.find(
      ({ id }) => id === request.team_credit_stop_id
    )

    this.state.status = {
      ...this.state.status,
      is_active: true,
      subscription_status: 'active',
      subscription_tier: plan?.tier ?? this.state.status.subscription_tier,
      subscription_duration:
        plan?.duration ?? this.state.status.subscription_duration,
      plan_slug: request.plan_slug,
      billing_status: 'paid',
      renewal_date: this.state.status.renewal_date ?? BILLING_RENEWAL_DATE,
      team_credit_stop:
        plan?.tier === 'TEAM' && stop
          ? {
              id: stop.id,
              credits_monthly: stop.credits,
              stop_usd: stop.yearly.list_price_cents / 100
            }
          : null
    }
    this.state.plans.current_plan_slug = request.plan_slug
    if (this.postSubscribeBalance) {
      this.state.balance = structuredClone(this.postSubscribeBalance)
    }
  }

  private applyTopup(amountCents: number): void {
    const balance = this.state.balance
    this.state.balance = {
      ...balance,
      amount_micros: balance.amount_micros + amountCents,
      effective_balance_micros:
        (balance.effective_balance_micros ?? balance.amount_micros) +
        amountCents,
      prepaid_balance_micros:
        (balance.prepaid_balance_micros ?? 0) + amountCents
    }
    this.state.status = { ...this.state.status, has_funds: true }
  }

  private applyCancel(cancelAt: string): void {
    this.state.status = {
      ...this.state.status,
      is_active: true,
      subscription_status: 'canceled',
      cancel_at: cancelAt
    }
  }

  private applyResubscribe(): void {
    const status = { ...this.state.status }
    delete status.cancel_at
    this.state.status = {
      ...status,
      is_active: true,
      subscription_status: 'active'
    }
  }
}

export const cloudBillingApiFixture = base.extend<{
  billingApi: CloudBillingApiMock
}>({
  billingApi: async ({ page }, use) => {
    const billingApi = new CloudBillingApiMock(page)
    await use(billingApi)
    await billingApi.dispose()
  }
})

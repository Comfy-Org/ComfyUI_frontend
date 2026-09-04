import { createBillingPoller } from './poller.js'
import { initialBillingState, reduceBilling } from './reducer.js'
import { createSingleFlight } from './singleFlight.js'
import type {
  BillingApiClient,
  BillingHostPorts,
  BillingOperationKind,
  BillingStatusResponse,
  BillingState,
  CancelRequest,
  PaymentPortalRequest,
  ResubscribeRequest,
  SubscribeRequest,
  TopupRequest
} from './types.js'

export interface BillingCommands {
  start(): Promise<void>
  subscribe(input: SubscribeRequest): Promise<void>
  topUp(input: TopupRequest, intent?: string): Promise<void>
  resubscribe(input: ResubscribeRequest, intent?: string): Promise<void>
  cancelSubscription(input: CancelRequest, intent?: string): Promise<void>
  openPaymentPortal(
    input: PaymentPortalRequest,
    intent?: string
  ): Promise<{ opened: boolean }>
  getState(): BillingState
  subscribeState(listener: (state: BillingState) => void): () => void
  reset(): void
  getBillingStatus(): BillingStatusResponse | undefined
}

export function createBillingCommands(options: {
  client: BillingApiClient
  ports: BillingHostPorts
}): BillingCommands {
  const attemptIntent = (kind: string) =>
    `${options.ports.operationStore.namespace}:${kind}:${crypto.randomUUID()}`
  let state = initialBillingState
  const listeners = new Set<(state: BillingState) => void>()
  const singleFlight = createSingleFlight()
  let billingStatus: BillingStatusResponse | undefined
  function publish(next: BillingState) {
    state = next
    listeners.forEach((listener) => listener(state))
  }
  const poller = createBillingPoller({
    client: options.client,
    clock: options.ports.clock,
    store: options.ports.operationStore,
    onState: publish,
    openUrl: options.ports.openUrl,
    handleNextAction: options.ports.handleNextAction,
    fallbackToHostedUrl: options.ports.fallbackToHostedUrl
  })
  async function follow(
    id: string,
    kind: BillingOperationKind,
    actionUrl?: string
  ) {
    publish(reduceBilling(state, { type: 'started', operationId: id }))
    if (actionUrl) {
      publish(reduceBilling(state, { type: 'urlReceived', url: actionUrl }))
      const { opened } = await options.ports.openUrl(actionUrl, 'new_tab')
      if (!opened) {
        publish(
          reduceBilling(state, { type: 'hostReturned', result: 'failed' })
        )
        return
      }
    }
    await poller.start(id, kind, actionUrl)
  }
  return {
    async start() {
      const status = await options.client.getStatus()
      billingStatus = status
      const operationId =
        status.pending_billing_op_id ??
        (await options.ports.operationStore.getActiveId())
      if (!operationId) return
      const kind =
        status.pending_billing_op_type === 'topup' ? 'topup' : 'subscribe'
      publish(
        reduceBilling(state, { type: 'started', operationId: operationId })
      )
      await poller.resume(operationId, kind)
    },
    async subscribe(input) {
      if (
        billingStatus?.is_active &&
        billingStatus.subscription_tier !== 'FREE'
      ) {
        if (billingStatus.subscription_status === 'canceled') {
          await this.resubscribe({})
        } else {
          publish(
            reduceBilling(state, { type: 'opStatus', status: 'succeeded' })
          )
        }
        return
      }
      await singleFlight('subscribe', async () =>
        options.client.subscribe(input).then(async (result) => {
          if (result.status === 'subscribed') {
            publish(
              reduceBilling(state, { type: 'opStatus', status: 'succeeded' })
            )
            return
          }
          await follow(
            result.billing_op_id,
            'subscribe',
            result.status === 'needs_payment_method'
              ? result.payment_method_url
              : undefined
          )
        })
      )
    },
    async topUp(input, intent = input.idempotency_key) {
      await singleFlight('topup', async () =>
        options.client
          .topup(input, intent)
          .then((result) =>
            follow(result.billing_op_id, 'topup', result.action_url)
          )
      )
    },
    async resubscribe(input, intent = attemptIntent('resubscribe')) {
      const result = await options.client.resubscribe(input, intent)
      if (result.status === 'pending' && result.billing_op_id)
        await follow(result.billing_op_id, 'resubscribe')
      else
        publish(reduceBilling(state, { type: 'opStatus', status: 'succeeded' }))
    },
    async cancelSubscription(
      input,
      intent = input.idempotency_key ?? attemptIntent('cancel')
    ) {
      const result = await options.client.cancel(input, intent)
      await follow(result.billing_op_id, 'cancel')
    },
    async openPaymentPortal(input, intent = attemptIntent('portal')) {
      const result = await options.client.paymentPortal(input, intent)
      return options.ports.openUrl(result.url, 'new_tab')
    },
    getState: () => state,
    subscribeState(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reset() {
      publish(initialBillingState)
    },
    getBillingStatus: () => billingStatus
  }
}

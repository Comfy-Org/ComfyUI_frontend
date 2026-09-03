import { createBillingPoller } from './poller.js'
import { initialBillingState, reduceBilling } from './reducer.js'
import { createSingleFlight } from './singleFlight.js'
import type {
  BillingClient,
  BillingHostPorts,
  BillingOperationKind,
  BillingState,
  CancelRequest,
  PaymentPortalRequest,
  ResubscribeRequest,
  SubscribeRequest,
  TopupRequest
} from './types.js'

export interface BillingCommands {
  start(): Promise<void>
  subscribe(input: SubscribeRequest, intent?: string): Promise<void>
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
}

export function createBillingCommands(options: {
  client: BillingClient
  ports: BillingHostPorts
}): BillingCommands {
  let state = initialBillingState
  const listeners = new Set<(state: BillingState) => void>()
  const singleFlight = createSingleFlight()
  function publish(next: BillingState) {
    state = next
    listeners.forEach((listener) => listener(state))
  }
  const poller = createBillingPoller({
    client: options.client,
    clock: options.ports.clock,
    store: options.ports.operationStore,
    onState: publish
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
    await poller.start(id, kind)
  }
  return {
    async start() {
      await poller.resume('subscribe')
    },
    async subscribe(
      input,
      intent = `${options.ports.operationStore.namespace}:subscribe:${input.plan_slug}`
    ) {
      await singleFlight('subscribe', async () =>
        options.client
          .subscribe(input, intent)
          .then((result) =>
            follow(result.billing_op_id, 'subscribe', result.action_url)
          )
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
    async resubscribe(
      input,
      intent = `${options.ports.operationStore.namespace}:resubscribe:${input.plan_slug ?? 'current'}`
    ) {
      const result = await options.client.resubscribe(input, intent)
      if (result.status === 'pending' && result.billing_op_id)
        await follow(result.billing_op_id, 'resubscribe')
      else
        publish(reduceBilling(state, { type: 'opStatus', status: 'succeeded' }))
    },
    async cancelSubscription(
      input,
      intent = input.idempotency_key ??
        `${options.ports.operationStore.namespace}:cancel`
    ) {
      const result = await options.client.cancel(input, intent)
      if (result.status === 'pending' && result.billing_op_id)
        await follow(result.billing_op_id, 'cancel')
      else
        publish(reduceBilling(state, { type: 'opStatus', status: 'succeeded' }))
    },
    async openPaymentPortal(
      input,
      intent = `${options.ports.operationStore.namespace}:portal`
    ) {
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
    }
  }
}

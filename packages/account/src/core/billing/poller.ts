import { reduceBilling } from './reducer.js'
import type {
  BillingApiClient,
  BillingClock,
  BillingOperationKind,
  BillingOperationStore,
  BillingState
} from './types.js'

export const billingPollTiming = {
  initialMs: 1_000,
  multiplier: 1.5,
  capMs: 8_000,
  mutationTimeoutMs: 120_000,
  subscriptionTimeoutMs: 300_000
} as const
export function createBillingPoller(options: {
  client: Pick<BillingApiClient, 'getOperation'>
  clock: BillingClock
  store: BillingOperationStore
  onState(state: BillingState): void
}) {
  let handle: unknown
  let stopped = false
  async function poll(
    id: string,
    kind: BillingOperationKind,
    startedAt: number,
    delay: number = billingPollTiming.initialMs
  ): Promise<void> {
    if (stopped) return
    const timeout =
      kind === 'subscribe' || kind === 'resubscribe'
        ? billingPollTiming.subscriptionTimeoutMs
        : billingPollTiming.mutationTimeoutMs
    if (options.clock.now() - startedAt >= timeout) {
      options.onState(
        reduceBilling(
          { operationId: id, step: 'verifying', noChargeConfirmed: false },
          { type: 'opStatus', status: 'timeout' }
        )
      )
      await options.store.clearActiveId()
      return
    }
    const response = await options.client.getOperation(id)
    let state: BillingState = {
      operationId: id,
      step: 'preview',
      noChargeConfirmed: false
    }
    if (response.action_url)
      state = reduceBilling(state, {
        type: 'urlReceived',
        url: response.action_url
      })
    state = reduceBilling(state, {
      type: 'opStatus',
      status: response.status,
      reason_code: response.reason_code,
      error_message: response.error_message,
      no_charge_confirmed: response.no_charge_confirmed
    })
    options.onState(state)
    if (response.status !== 'pending') {
      await options.store.clearActiveId()
      return
    }
    const next = Math.min(
      delay * billingPollTiming.multiplier,
      billingPollTiming.capMs
    )
    handle = options.clock.schedule(
      () => void poll(id, kind, startedAt, next),
      delay
    )
  }
  return {
    async start(id: string, kind: BillingOperationKind) {
      stopped = false
      await options.store.setActiveId(id)
      await poll(id, kind, options.clock.now())
    },
    async resume(kind: BillingOperationKind) {
      const id = await options.store.getActiveId()
      if (id) await poll(id, kind, options.clock.now())
      return id
    },
    stop() {
      stopped = true
      if (handle !== undefined) options.clock.cancel(handle)
    }
  }
}

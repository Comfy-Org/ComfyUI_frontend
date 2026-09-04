import { reduceBilling } from './reducer.js'
import type {
  BillingApiClient,
  BillingClock,
  BillingOperationKind,
  BillingOperationStore,
  OpenUrlMode,
  BillingState
} from './types.js'

export const billingPollTiming = {
  initialMs: 1_000,
  multiplier: 1.5,
  capMs: 8_000,
  mutationTimeoutMs: 120_000,
  checkoutExpiryMs: 6 * 60 * 60 * 1_000
} as const
const resumeDelaysMs = [3_000, 10_000, 30_000] as const
export function createBillingPoller(options: {
  client: Pick<BillingApiClient, 'getOperation'>
  clock: BillingClock
  store: BillingOperationStore
  onState(state: BillingState): void
  openUrl?(url: string, mode: OpenUrlMode): Promise<{ opened: boolean }>
  handleNextAction?: (
    clientSecret: string
  ) => Promise<{ error?: { message: string; code?: string } }>
  fallbackToHostedUrl?: boolean
}) {
  let handle: unknown
  let stopped = false
  let openedActionUrl: string | undefined
  let actionRequired = false
  const handledClientSecrets = new Set<string>()
  async function poll(
    id: string,
    startedAt: number,
    delay: number = billingPollTiming.initialMs,
    resumeAttempt?: number
  ): Promise<void> {
    if (stopped) return
    if (
      !actionRequired &&
      options.clock.now() - startedAt >= billingPollTiming.mutationTimeoutMs
    ) {
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
    const clientSecret = response.payment_intent_client_secret
    const requiresNextAction =
      response.authentication_state === 'requires_action' &&
      clientSecret !== undefined
    actionRequired ||= response.action_url !== undefined || requiresNextAction
    const parsedStartedAt = response.started_at
      ? Date.parse(response.started_at)
      : Number.NaN
    const backendStartedAt = Number.isNaN(parsedStartedAt)
      ? startedAt
      : parsedStartedAt
    if (
      response.status === 'pending' &&
      actionRequired &&
      options.clock.now() - backendStartedAt >=
        billingPollTiming.checkoutExpiryMs
    ) {
      options.onState(
        reduceBilling(
          {
            operationId: id,
            step: 'verifying',
            actionUrl: response.action_url ?? openedActionUrl,
            noChargeConfirmed: false
          },
          { type: 'opStatus', status: 'expired' }
        )
      )
      await options.store.clearActiveId()
      return
    }
    let state: BillingState = {
      operationId: id,
      step: resumeAttempt === undefined ? 'preview' : 'verifying',
      noChargeConfirmed: false
    }
    const actionUrl = response.action_url ?? openedActionUrl
    if (actionRequired && actionUrl)
      state = reduceBilling(state, {
        type: 'urlReceived',
        url: actionUrl
      })
    let nextActionFailed = false
    if (
      requiresNextAction &&
      options.handleNextAction &&
      !handledClientSecrets.has(clientSecret)
    ) {
      handledClientSecrets.add(clientSecret)
      const result = await options.handleNextAction(clientSecret)
      if (result.error) {
        nextActionFailed = true
        state = reduceBilling(state, {
          type: 'actionFailed',
          message: result.error.message
        })
      }
    }
    const shouldOpenHostedUrl =
      !requiresNextAction ||
      !options.handleNextAction ||
      (nextActionFailed && options.fallbackToHostedUrl === true)
    if (
      shouldOpenHostedUrl &&
      response.action_url &&
      response.action_url !== openedActionUrl
    ) {
      openedActionUrl = response.action_url
      await options.openUrl?.(response.action_url, 'new_tab')
    }
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
    const scheduledDelay =
      resumeAttempt === undefined
        ? response.action_url
          ? 30_000
          : delay
        : (resumeDelaysMs[resumeAttempt] ?? 30_000)
    const next = Math.min(
      scheduledDelay * billingPollTiming.multiplier,
      billingPollTiming.capMs
    )
    handle = options.clock.schedule(
      () =>
        void poll(
          id,
          startedAt,
          next,
          resumeAttempt === undefined ? undefined : resumeAttempt + 1
        ),
      scheduledDelay
    )
  }
  return {
    async start(id: string, kind: BillingOperationKind, actionUrl?: string) {
      void kind
      stopped = false
      openedActionUrl = actionUrl
      actionRequired = actionUrl !== undefined
      handledClientSecrets.clear()
      await options.store.setActiveId(id)
      await poll(id, options.clock.now())
    },
    async resume(id: string, kind: BillingOperationKind) {
      void kind
      stopped = false
      openedActionUrl = undefined
      actionRequired = true
      handledClientSecrets.clear()
      await options.store.setActiveId(id)
      await poll(id, options.clock.now(), billingPollTiming.initialMs, 0)
    },
    stop() {
      stopped = true
      if (handle !== undefined) options.clock.cancel(handle)
    }
  }
}

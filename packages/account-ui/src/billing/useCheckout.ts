import type {
  PaymentPortalResult,
  SubscribeInput,
  SubscriptionCommandResult
} from '@comfyorg/account-core/billing'
/**
 * The headless subscription checkout over the shared billing commands. The
 * request shape is the generated one; eligibility, single-flight, and the
 * eight-state outcome are the core's. Cancelling a subscription is not a
 * checkout and stays on `client.commands` for the host to call.
 */
import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'
import type { PaymentAttempt, PaymentNavigation } from './usePaymentAttempt'
import { usePaymentAttempt } from './usePaymentAttempt'

export interface CheckoutOptions extends PaymentNavigation {
  readonly client?: Pick<BillingClient, 'lifecycle' | 'commands'>
}

export interface Checkout extends PaymentAttempt {
  readonly submitting: Readonly<Ref<boolean>>
  readonly result: Readonly<Ref<SubscriptionCommandResult | undefined>>
  readonly subscribe: (
    input: SubscribeInput
  ) => Promise<SubscriptionCommandResult>
  readonly resubscribe: () => Promise<SubscriptionCommandResult>
  /** Drops the settled attempt and resends the last subscribe request. */
  readonly retry: () => Promise<SubscriptionCommandResult>
  /** Resolves the portal URL and hands it to the host's navigation. */
  readonly openPaymentPortal: (input?: {
    readonly returnUrl?: string
  }) => Promise<PaymentPortalResult>
}

const NOTHING_TO_RETRY: SubscriptionCommandResult = {
  status: 'error',
  code: 'INVALID_REQUEST'
}

export function useCheckout(options: CheckoutOptions): Checkout {
  const client = useBillingClient(options.client)
  const { openUrl, navigationMode = 'new_tab' } = options
  const attempt = usePaymentAttempt('subscription', client, options)

  const submitting = ref(false)
  const result = ref<SubscriptionCommandResult | undefined>()
  let lastInput: SubscribeInput | undefined

  async function run(
    command: () => Promise<SubscriptionCommandResult>
  ): Promise<SubscriptionCommandResult> {
    submitting.value = true
    const outcome = await command()
    submitting.value = false
    result.value = outcome
    return outcome
  }

  function subscribe(input: SubscribeInput) {
    lastInput = input
    return run(() => client.commands.subscribe(input))
  }

  function retry() {
    if (lastInput === undefined) return Promise.resolve(NOTHING_TO_RETRY)
    attempt.reset()
    attempt.preview()
    result.value = undefined
    return subscribe(lastInput)
  }

  async function openPaymentPortal(
    input: { readonly returnUrl?: string } = {}
  ) {
    const portal = await client.commands.openPaymentPortal(input)
    if (portal.status === 'ok') openUrl(portal.value.url, navigationMode)
    return portal
  }

  return {
    ...attempt,
    submitting: shallowReadonly(submitting),
    result: shallowReadonly(result),
    subscribe,
    resubscribe: () => run(() => client.commands.resubscribe()),
    retry,
    openPaymentPortal
  }
}

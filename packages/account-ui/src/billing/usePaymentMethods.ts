import type {
  BillingFailure,
  BillingResult,
  PaymentMethodsSnapshot,
  SavedPaymentMethod
} from '@comfyorg/account-core/billing'
import { computed, ref, shallowReadonly } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'

export interface PaymentMethodsOptions {
  readonly client?: Pick<BillingClient, 'paymentMethods'>
  /** Read once on setup; false leaves the first read to the host. */
  readonly immediate?: boolean
}

export interface PaymentMethods {
  /** The cards the server publishes for this workspace, in its order. */
  readonly methods: Readonly<Ref<readonly SavedPaymentMethod[] | undefined>>
  readonly defaultMethod: ComputedRef<SavedPaymentMethod | undefined>
  readonly loading: Readonly<Ref<boolean>>
  /**
   * The last read's failure; a failed refresh keeps the previous list on
   * screen. A scope change is not surfaced as one: it drops the list, which
   * names cards the workspace the host moved to cannot charge, and leaves
   * nothing for the user to retry.
   */
  readonly failure: Readonly<Ref<BillingFailure | undefined>>
  readonly refresh: () => Promise<BillingResult<PaymentMethodsSnapshot>>
  /**
   * Drops the published list before re-reading it, for a host coming back
   * from the payment portal where a card was added or removed.
   */
  readonly invalidateAndRefresh: () => Promise<
    BillingResult<PaymentMethodsSnapshot>
  >
}

export function usePaymentMethods(
  options: PaymentMethodsOptions = {}
): PaymentMethods {
  const { paymentMethods: reader } = useBillingClient(options.client)
  const { immediate = true } = options
  const methods = ref<readonly SavedPaymentMethod[] | undefined>(
    reader.getSnapshot()?.methods
  )
  const loading = ref(false)
  const failure = ref<BillingFailure | undefined>()

  // A read that settles after a later one started says nothing about the list
  // that one published, and its `SUPERSEDED` would drop it.
  let latestAttempt = 0

  async function refresh() {
    const attempt = ++latestAttempt
    loading.value = true
    const result = await reader.read()
    if (attempt !== latestAttempt) return result
    loading.value = false
    if (result.status === 'ok') {
      methods.value = result.value.methods
      failure.value = undefined
    } else if (result.code === 'SUPERSEDED') {
      methods.value = undefined
      failure.value = undefined
    } else {
      failure.value = result
    }
    return result
  }

  function invalidateAndRefresh() {
    reader.invalidate()
    methods.value = undefined
    return refresh()
  }

  if (immediate) void refresh()

  return {
    methods: shallowReadonly(methods),
    defaultMethod: computed(() =>
      methods.value?.find((method) => method.is_default)
    ),
    loading: shallowReadonly(loading),
    failure: shallowReadonly(failure),
    refresh,
    invalidateAndRefresh
  }
}

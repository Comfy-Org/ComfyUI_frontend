import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingFailure,
  BillingPlansData,
  BillingResult,
  PlansSnapshot
} from '@comfyorg/account-core/billing'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'

export interface PlansOptions {
  readonly client?: Pick<BillingClient, 'plans'>
  /** Read once on setup; false leaves the first read to the host. */
  readonly immediate?: boolean
}

export interface Plans {
  /** The catalog the server resolved for this actor; nothing is filtered, ranked or priced here. */
  readonly plans: Readonly<Ref<BillingPlansData | undefined>>
  readonly loading: Readonly<Ref<boolean>>
  /**
   * The last read's failure; a failed refresh keeps the previous catalog on
   * screen. A scope change is not surfaced as one: it drops the catalog,
   * which was resolved for an actor the host has left, and leaves nothing for
   * the user to retry.
   */
  readonly failure: Readonly<Ref<BillingFailure | undefined>>
  readonly refresh: () => Promise<BillingResult<PlansSnapshot>>
}

export function usePlans(options: PlansOptions = {}): Plans {
  const { plans: reader } = useBillingClient(options.client)
  const { immediate = true } = options
  const plans = ref<BillingPlansData | undefined>(reader.getSnapshot()?.data)
  const loading = ref(false)
  const failure = ref<BillingFailure | undefined>()

  // A read that settles after a later one started says nothing about the
  // catalog that one published, and its `SUPERSEDED` would drop it.
  let latestAttempt = 0

  async function refresh() {
    const attempt = ++latestAttempt
    loading.value = true
    const result = await reader.read()
    if (attempt !== latestAttempt) return result
    loading.value = false
    if (result.status === 'ok') {
      plans.value = result.value.data
      failure.value = undefined
    } else if (result.code === 'SUPERSEDED') {
      plans.value = undefined
      failure.value = undefined
    } else {
      failure.value = result
    }
    return result
  }

  if (immediate) void refresh()

  return {
    plans: shallowReadonly(plans),
    loading: shallowReadonly(loading),
    failure: shallowReadonly(failure),
    refresh
  }
}

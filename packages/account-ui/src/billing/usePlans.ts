import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingFailure,
  BillingPlansData,
  BillingResult,
  PlansSnapshot
} from '@comfyorg/account/billing'

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
  /** The last read's failure; a failed refresh keeps the previous catalog on screen. */
  readonly failure: Readonly<Ref<BillingFailure | undefined>>
  readonly refresh: () => Promise<BillingResult<PlansSnapshot>>
}

export function usePlans(options: PlansOptions = {}): Plans {
  const { plans: reader } = useBillingClient(options.client)
  const { immediate = true } = options
  const plans = ref<BillingPlansData | undefined>(reader.getSnapshot()?.data)
  const loading = ref(false)
  const failure = ref<BillingFailure | undefined>()

  async function refresh() {
    loading.value = true
    const result = await reader.read()
    loading.value = false
    if (result.status === 'ok') {
      plans.value = result.value.data
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

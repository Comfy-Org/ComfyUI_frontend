import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingBalance,
  BillingFailure,
  BillingResult,
  CreditsSnapshot
} from '@comfyorg/account/billing'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'

export interface CreditsOptions {
  readonly client?: Pick<BillingClient, 'credits'>
  /** Read once on setup; false leaves the first read to the host. */
  readonly immediate?: boolean
}

export interface Credits {
  /** Micros, as the core reports them; formatting is the host's, with its locale. */
  readonly balance: Readonly<Ref<BillingBalance | undefined>>
  readonly loading: Readonly<Ref<boolean>>
  /** The last read's failure; a failed refresh keeps the previous balance on screen. */
  readonly failure: Readonly<Ref<BillingFailure | undefined>>
  readonly refresh: () => Promise<BillingResult<CreditsSnapshot>>
}

export function useCredits(options: CreditsOptions = {}): Credits {
  const { credits } = useBillingClient(options.client)
  const { immediate = true } = options
  const balance = ref<BillingBalance | undefined>(
    credits.getSnapshot()?.balance
  )
  const loading = ref(false)
  const failure = ref<BillingFailure | undefined>()

  async function refresh() {
    loading.value = true
    const result = await credits.read()
    loading.value = false
    if (result.status === 'ok') {
      balance.value = result.value.balance
      failure.value = undefined
    } else {
      failure.value = result
    }
    return result
  }

  if (immediate) void refresh()

  return {
    balance: shallowReadonly(balance),
    loading: shallowReadonly(loading),
    failure: shallowReadonly(failure),
    refresh
  }
}

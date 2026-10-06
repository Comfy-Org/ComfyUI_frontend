import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingBalance,
  BillingFailure,
  BillingResult,
  CreditsSnapshot
} from '@comfyorg/account-core/billing'

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
  /**
   * The last read's failure; a failed refresh keeps the previous balance on
   * screen. A scope change is not surfaced as one: it drops the balance,
   * which states the credits of the workspace the host left, and leaves
   * nothing for the user to retry.
   */
  readonly failure: Readonly<Ref<BillingFailure | undefined>>
  /**
   * Reads the balance again. Only the newest read publishes: an earlier one
   * that settles after it still answers its own caller, so the scope change
   * that condemned it cannot clear the balance that replaced it.
   */
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

  let latest = 0

  async function refresh() {
    const attempt = ++latest
    loading.value = true
    const result = await credits.read()
    if (attempt !== latest) return result

    loading.value = false
    if (result.status === 'ok') {
      balance.value = result.value.balance
      failure.value = undefined
    } else if (result.code === 'SUPERSEDED') {
      balance.value = undefined
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

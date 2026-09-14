import { tryOnScopeDispose } from '@vueuse/core'
import { ref, shallowReadonly, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import type {
  BillingOperationKind,
  BillingOperationState
} from '@comfyorg/account/billing'

import type { BillingClient } from './billingClient'
import { useBillingClient } from './billingClient'

/** One operation by id, or whichever of a kind the lifecycle observed last. */
export type BillingOperationSelector =
  | { readonly id: string }
  | { readonly kind: BillingOperationKind }

function matches(
  selector: BillingOperationSelector,
  state: BillingOperationState
): boolean {
  return 'id' in selector
    ? state.id === selector.id
    : state.kind === selector.kind
}

function newer(
  candidate: BillingOperationState,
  current: BillingOperationState | undefined
): boolean {
  return (
    current === undefined ||
    candidate.id === current.id ||
    candidate.observedAt >= current.observedAt
  )
}

/**
 * A reactive view of one lifecycle operation. Subscribes once and lets go
 * with the scope that called it.
 */
export function useBillingOperation(
  selector: MaybeRefOrGetter<BillingOperationSelector | undefined>,
  client?: Pick<BillingClient, 'lifecycle'>
): Readonly<Ref<BillingOperationState | undefined>> {
  const { lifecycle } = useBillingClient(client)
  const operation = ref<BillingOperationState | undefined>()

  function offer(state: BillingOperationState) {
    const wanted = toValue(selector)
    if (wanted === undefined || !matches(wanted, state)) return
    if (newer(state, operation.value)) operation.value = state
  }

  watch(
    () => toValue(selector),
    () => {
      operation.value = undefined
      for (const state of lifecycle.getSnapshot()) offer(state)
    },
    { immediate: true }
  )
  tryOnScopeDispose(lifecycle.subscribe(offer))

  return shallowReadonly(operation)
}

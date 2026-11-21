import { ref, shallowReadonly } from 'vue'
import type { Ref } from 'vue'

import type {
  BillingEntry,
  BillingEntryErrorCode,
  BillingEntryResult
} from '@comfyorg/billing-contract'

/**
 * The request a product made, for the lifetime of this tab. A module ref
 * rather than a store: the app has no Pinia, the entry is written once per
 * navigation by the router guard, and every surface only reads it.
 */
const entry = ref<BillingEntry | undefined>()
const error = ref<BillingEntryErrorCode | undefined>()

export interface BillingEntryState {
  readonly entry: Readonly<Ref<BillingEntry | undefined>>
  /** Set when the arriving URL is not a request the contract describes. */
  readonly error: Readonly<Ref<BillingEntryErrorCode | undefined>>
}

export function useBillingEntry(): BillingEntryState {
  return { entry: shallowReadonly(entry), error: shallowReadonly(error) }
}

/** Publishes a parse result; `undefined` clears the entry for a route outside the contract. */
export function recordBillingEntry(
  result: BillingEntryResult | undefined
): void {
  entry.value = result?.status === 'ok' ? result.entry : undefined
  error.value = result?.status === 'error' ? result.code : undefined
}

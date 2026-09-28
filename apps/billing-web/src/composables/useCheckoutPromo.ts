import { computed, shallowReadonly, shallowRef } from 'vue'

import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'

import type { PromoEntry, PromoEntryEvent } from '@/checkout/promoEntry'
import {
  initialPromoEntry,
  promoRejectionOf,
  reducePromoEntry
} from '@/checkout/promoEntry'

interface CheckoutPromoOptions {
  /** A code the entry URL carried; it opens the field and waits for Apply. */
  readonly prefill: string | undefined
  /** Whether the customer may change the code right now. */
  readonly live: () => boolean
  /** Prices the plan again, with the code or, when omitted, without one. */
  readonly requote: (promotionCode?: string) => Promise<PreviewSubscribeResult>
}

/**
 * The promo entry's effects: every intent is a re-quote, and every answer goes
 * through `reducePromoEntry`. A refused code never touches the quote, because
 * a failed quote leaves the last one standing.
 */
export function useCheckoutPromo({
  prefill,
  live,
  requote
}: CheckoutPromoOptions) {
  const entry = shallowRef<PromoEntry>(initialPromoEntry(prefill))

  function dispatch(event: PromoEntryEvent) {
    entry.value = reducePromoEntry(entry.value, event)
  }

  function intend(event: PromoEntryEvent) {
    if (live()) dispatch(event)
  }

  async function apply() {
    if (!live()) return
    dispatch({ type: 'applyRequested' })
    const current = entry.value
    if (current.kind !== 'applying') return
    const result = await requote(current.draft)
    if (result.status === 'error') {
      dispatch({ type: 'applyRejected', reason: promoRejectionOf(result) })
      return
    }
    const code = result.value.promotion_code
    dispatch(
      code === undefined
        ? { type: 'applyRejected', reason: 'invalid' }
        : { type: 'applyAccepted', code }
    )
  }

  async function remove() {
    if (!live() || entry.value.kind !== 'applied') return
    dispatch({ type: 'removeRequested' })
    const result = await requote()
    dispatch({
      type: result.status === 'ok' ? 'removeSettled' : 'removeFailed'
    })
  }

  return {
    entry: shallowReadonly(entry),
    /** A re-quote for the code is in flight, so the price on screen is not final. */
    busy: computed(
      () => entry.value.kind === 'applying' || entry.value.kind === 'removing'
    ),
    appliedCode: computed(() =>
      entry.value.kind === 'applied' ? entry.value.code : undefined
    ),
    open: () => intend({ type: 'opened' }),
    edit: (draft: string) => intend({ type: 'edited', draft }),
    dismiss: () => intend({ type: 'dismissed' }),
    apply,
    remove,
    expire: () => dispatch({ type: 'expired' })
  }
}

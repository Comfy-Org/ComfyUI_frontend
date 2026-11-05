import { computed, shallowReadonly, shallowRef } from 'vue'

import type { PreviewSubscribeResult } from '@comfyorg/account-core/billing'

import type {
  PromoEntry,
  PromoEntryEvent,
  PromoPrefill
} from '@/checkout/promoEntry'
import {
  hasUnappliedDraft,
  initialPromoEntry,
  promoRejectionOf,
  reducePromoEntry
} from '@/checkout/promoEntry'
import type { PromoMemory } from '@/checkout/promoMemory'
import { codeToRemember } from '@/checkout/promoMemory'

interface CheckoutPromoOptions {
  /** What the entry URL carried; a code opens the field and waits for Apply. */
  readonly prefill: PromoPrefill | undefined
  /** Whether the customer may change the code right now. */
  readonly live: () => boolean
  /** Prices the plan again, with the code or, when omitted, without one. */
  readonly requote: (promotionCode?: string) => Promise<PreviewSubscribeResult>
  /** Where an applied code outlives a reload or a provider return. */
  readonly memory: PromoMemory
}

/**
 * The promo entry's effects: every intent is a re-quote, and every answer goes
 * through `reducePromoEntry`. A refused code never touches the quote, because
 * a failed quote leaves the last one standing. The applied code is kept in
 * `memory` whenever a transition changes it.
 */
export function useCheckoutPromo({
  prefill,
  live,
  requote,
  memory
}: CheckoutPromoOptions) {
  const entry = shallowRef<PromoEntry>(
    initialPromoEntry(prefill, memory.recall())
  )

  function dispatch(event: PromoEntryEvent) {
    const kept = codeToRemember(entry.value)
    entry.value = reducePromoEntry(entry.value, event)
    const next = codeToRemember(entry.value)
    if (next !== kept) memory.keep(next)
  }

  function intend(event: PromoEntryEvent) {
    if (live()) dispatch(event)
  }

  async function apply() {
    const typed = entry.value
    if (!live() || (typed.kind !== 'editing' && typed.kind !== 'rejected'))
      return
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
    unapplied: computed(() => hasUnappliedDraft(entry.value)),
    appliedCode: computed(() =>
      entry.value.kind === 'applied' ? entry.value.code : undefined
    ),
    open: () => intend({ type: 'opened' }),
    edit: (draft: string) => intend({ type: 'edited', draft }),
    dismiss: () => intend({ type: 'dismissed' }),
    apply,
    remove,
    expire: () => dispatch({ type: 'expired' }),
    /** The quote takes no code, so whatever the link carried is dropped. */
    withdraw: () => dispatch({ type: 'dismissed' })
  }
}

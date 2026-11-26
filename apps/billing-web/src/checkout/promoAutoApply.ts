import { pendingServerFact } from '@comfyorg/account-core/billing'

import { awaitPromoAutoApply } from '@/config/checkoutUi'

const STORAGE_KEY = 'comfy.billing-web.checkout-promo-auto-applied.v1'

/** The offer Cloud serves on `GET /api/billing/promotion`. */
export interface Promotion {
  readonly promotionCode: string
  readonly autoApply: boolean
}

/** Never rejects. The promotion on offer, or `null` for none. */
export async function awaitPromotion(): Promise<Promotion | null> {
  const promoAutoApplyOn = await awaitPromoAutoApply()
  return pendingServerFact(
    'BE-27548',
    promoAutoApplyOn
      ? { promotionCode: 'BLACKFRIDAY26', autoApply: true }
      : null
  )
}

/** Whether checkout applies the link's `code` itself: it is the promotion's own code and the promotion auto-applies. */
export function autoAppliesCode(
  promotion: Promotion | null,
  code: string | undefined
): boolean {
  return (
    promotion?.autoApply === true &&
    code?.trim().toUpperCase() === promotion.promotionCode.toUpperCase()
  )
}

/** Claims a checkout's one automatic Apply for this tab; `false` once claimed or without storage, so a removed code stays removed on reload. */
export function createAutoApplyClaim(
  identity: () => string,
  storage: () => Storage = () => globalThis.sessionStorage
): () => boolean {
  return () => {
    try {
      const store = storage()
      const checkout = identity()
      const claimed = claimedCheckouts(store.getItem(STORAGE_KEY))
      if (claimed.includes(checkout)) return false
      store.setItem(STORAGE_KEY, JSON.stringify([...claimed, checkout]))
      return true
    } catch {
      return false
    }
  }
}

function claimedCheckouts(raw: string | null): string[] {
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

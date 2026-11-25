const STORAGE_KEY = 'comfy.billing-web.checkout-promo-auto-applied.v1'

const AUTO_APPLY_PROMO_CODE = 'BLACKFRIDAY26'

/** Whether `code` is the one promo code checkout applies from a link without an Apply click. */
export function isAutoApplyPromoCode(code: string | undefined): boolean {
  return code?.trim().toUpperCase() === AUTO_APPLY_PROMO_CODE
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
      if (store.getItem(STORAGE_KEY) === checkout) return false
      store.setItem(STORAGE_KEY, checkout)
      return true
    } catch {
      return false
    }
  }
}

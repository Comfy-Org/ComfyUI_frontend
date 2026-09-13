const BUY_CREDITS_EVENT = 'comfy:workshop-buy-credits'

export function requestWorkshopBuyCredits(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(BUY_CREDITS_EVENT))
}

export function subscribeToWorkshopBuyCredits(
  listener: () => void
): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(BUY_CREDITS_EVENT, listener)
  return () => window.removeEventListener(BUY_CREDITS_EVENT, listener)
}

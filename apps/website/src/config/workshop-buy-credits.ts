export type WorkshopBuyCreditsTrigger = 'action' | 'automatic'

const listeners = new Set<(trigger: WorkshopBuyCreditsTrigger) => void>()
let pendingRequest: WorkshopBuyCreditsTrigger | undefined

export function requestWorkshopBuyCredits(): void {
  dispatchWorkshopBuyCredits('action')
}

export function requestWorkshopBuyCreditsAutomatically(): void {
  dispatchWorkshopBuyCredits('automatic')
}

function dispatchWorkshopBuyCredits(trigger: WorkshopBuyCreditsTrigger): void {
  if (typeof window === 'undefined') return
  if (listeners.size === 0) {
    pendingRequest = pendingRequest === 'action' ? 'action' : trigger
    return
  }
  for (const listener of listeners) listener(trigger)
}

export function subscribeToWorkshopBuyCredits(
  listener: (trigger: WorkshopBuyCreditsTrigger) => void
): () => void {
  if (typeof window === 'undefined') return () => {}
  listeners.add(listener)
  if (pendingRequest !== undefined) {
    const trigger = pendingRequest
    pendingRequest = undefined
    listener(trigger)
  }
  return () => listeners.delete(listener)
}

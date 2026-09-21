const listeners = new Set<() => void>()
let pendingRequest = false

export function requestWorkshopBuyCredits(): void {
  if (typeof window === 'undefined') return
  if (listeners.size === 0) {
    pendingRequest = true
    return
  }
  for (const listener of listeners) listener()
}

export function subscribeToWorkshopBuyCredits(
  listener: () => void
): () => void {
  if (typeof window === 'undefined') return () => {}
  listeners.add(listener)
  if (pendingRequest) {
    pendingRequest = false
    listener()
  }
  return () => listeners.delete(listener)
}

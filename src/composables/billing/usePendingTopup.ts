import type { AuditLog } from '@/services/customerEventsService'

const STORAGE_KEY = 'pending_topup_timestamp'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

function getPendingTopupTimestamp(): number | null {
  const timestampStr = localStorage.getItem(STORAGE_KEY)
  if (timestampStr === null) return null

  const timestamp = Number(timestampStr)
  const age = Date.now() - timestamp
  if (Number.isSafeInteger(timestamp) && age >= 0 && age <= MAX_AGE_MS) {
    return timestamp
  }

  localStorage.removeItem(STORAGE_KEY)
  return null
}

/**
 * Pending credit top-up marker (localStorage) so the balance can refresh on
 * return from Stripe checkout. Pure billing state, no telemetry dependency, so
 * it works regardless of telemetry consent.
 */
export function usePendingTopup() {
  // Mark a top-up as pending before opening the Stripe checkout window.
  function startPendingTopup(): void {
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }

  // True if a credit top-up completed after tracking started; clears on hit.
  function isPendingTopupCompleted(
    events: AuditLog[] | undefined | null
  ): boolean {
    const timestamp = getPendingTopupTimestamp()
    if (timestamp === null) return false
    if (!events || events.length === 0) return false

    const completedTopup = events.find(
      (e) =>
        e.event_type === 'credit_added' &&
        e.createdAt &&
        new Date(e.createdAt).getTime() > timestamp
    )

    if (completedTopup) {
      localStorage.removeItem(STORAGE_KEY)
      return true
    }
    return false
  }

  // Non-consuming: true if a pending top-up is awaiting a balance refresh.
  function pendingTopupNeedsRefresh(): boolean {
    return getPendingTopupTimestamp() !== null
  }

  // Clear any pending top-up marker.
  function clearPendingTopup(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    startPendingTopup,
    isPendingTopupCompleted,
    pendingTopupNeedsRefresh,
    clearPendingTopup
  }
}

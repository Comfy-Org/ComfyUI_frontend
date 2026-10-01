import type { AuditLog } from '@/services/customerEventsService'

const STORAGE_KEY = 'pending_topup_timestamp'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CompletedTopup {
  /** Set when the checkout tab opened, one purchase request after `started`. */
  startedAtMs: number
}

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

  // The top-up a later credit_added completed, if any; clears the marker on hit.
  function consumeCompletedTopup(
    events: AuditLog[] | undefined | null
  ): CompletedTopup | null {
    const timestamp = getPendingTopupTimestamp()
    if (timestamp === null) return null
    if (!events || events.length === 0) return null

    const completedTopup = events.find(
      (e) =>
        e.event_type === 'credit_added' &&
        e.createdAt &&
        new Date(e.createdAt).getTime() > timestamp
    )

    if (!completedTopup) return null
    localStorage.removeItem(STORAGE_KEY)
    return { startedAtMs: timestamp }
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
    consumeCompletedTopup,
    pendingTopupNeedsRefresh,
    clearPendingTopup
  }
}

import type { AuditLog } from '@/services/customerEventsService'

const STORAGE_KEY = 'pending_topup_timestamp'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Tracks a pending credit top-up via a localStorage marker so the balance can
 * refresh on return. Pure billing state with no telemetry dependency, so it
 * works regardless of telemetry consent.
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
    const timestampStr = localStorage.getItem(STORAGE_KEY)
    if (!timestampStr) return false

    const timestamp = parseInt(timestampStr, 10)

    // Auto-cleanup once the marker is older than 24 hours.
    if (Date.now() - timestamp > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }

    if (!events || events.length === 0) return false

    // Legacy /customers/events emits `credit_added`; unified billing emits `topup_completed`.
    const completedTopup = events.find(
      (e) =>
        (e.event_type === 'credit_added' ||
          e.event_type === 'topup_completed') &&
        e.createdAt &&
        new Date(e.createdAt).getTime() > timestamp
    )

    if (completedTopup) {
      localStorage.removeItem(STORAGE_KEY)
      return true
    }

    return false
  }

  // Clear any pending top-up marker.
  function clearPendingTopup(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  // Consume the marker on window focus; true if a non-expired purchase awaited a refresh.
  function consumePendingTopup(): boolean {
    const timestampStr = localStorage.getItem(STORAGE_KEY)
    if (!timestampStr) return false

    localStorage.removeItem(STORAGE_KEY)
    const timestamp = parseInt(timestampStr, 10)
    return Date.now() - timestamp <= MAX_AGE_MS
  }

  return {
    startPendingTopup,
    isPendingTopupCompleted,
    clearPendingTopup,
    consumePendingTopup
  }
}

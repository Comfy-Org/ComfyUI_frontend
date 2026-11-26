import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

const BUSY_REREAD_DEFAULT_MS = 5_000

/** Most automatic re-reads per busy stretch. */
export const MAX_BUSY_REREADS = 3

/** True for the 409 `SUBSCRIPTION_CHANGE_IN_PROGRESS` answer, a transient busy state. */
export function isSubscriptionChangeInProgress(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    error.status === 409 &&
    error.code === 'SUBSCRIPTION_CHANGE_IN_PROGRESS'
  )
}

/** Retry-After capped at 60s, else 5s. */
export function busyRereadDelayMs(error: unknown): number {
  const seconds =
    error instanceof WorkspaceApiError ? error.retryAfterSeconds : undefined
  return seconds !== undefined && seconds > 0
    ? Math.min(seconds, 60) * 1_000
    : BUSY_REREAD_DEFAULT_MS
}

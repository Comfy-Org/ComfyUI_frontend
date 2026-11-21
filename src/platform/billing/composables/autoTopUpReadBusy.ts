import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

/** Wait before reading auto top-up settings again when the server gives no Retry-After. */
const BUSY_REREAD_DEFAULT_MS = 5_000

/** Re-reads per busy stretch; after that the next refresh (tab return, retry, reopen) reads. */
export const MAX_BUSY_REREADS = 3

/**
 * `GET /billing/auto-reload` answers 409 `SUBSCRIPTION_CHANGE_IN_PROGRESS`
 * while a billing operation holds the workspace (documented: retry after it
 * completes). That is a normal transient state, not a failed read.
 */
export function isSubscriptionChangeInProgress(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    error.status === 409 &&
    error.code === 'SUBSCRIPTION_CHANGE_IN_PROGRESS'
  )
}

export function busyRereadDelayMs(error: unknown): number {
  const seconds =
    error instanceof WorkspaceApiError ? error.retryAfterSeconds : undefined
  return seconds !== undefined && seconds > 0
    ? Math.min(seconds, 60) * 1_000
    : BUSY_REREAD_DEFAULT_MS
}

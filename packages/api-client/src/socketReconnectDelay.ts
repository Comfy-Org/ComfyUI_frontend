export const SERVICE_RESTART_CLOSE_CODE = 1012
export const OPENED_SOCKET_RECONNECT_WINDOW_MS = 5_000
export const SERVICE_RESTART_RECONNECT_WINDOW_MS = 30_000
export const FAILED_RECONNECT_BASE_DELAY_MS = 1_000
export const FAILED_RECONNECT_MAX_DELAY_MS = 30_000
export const SESSION_RECOVERY_MAX_DELAY_MS = 60_000

export type SocketClose =
  | { readonly opened: true; readonly code?: number }
  | { readonly opened: false; readonly failedAttempts: number }

function failedReconnectCeilingMs(failedAttempts: number, maxDelayMs: number) {
  return Math.min(
    maxDelayMs,
    FAILED_RECONNECT_BASE_DELAY_MS * 2 ** failedAttempts
  )
}

/**
 * Full-jitter delay before reopening a closed socket, so tabs dropped together
 * by a server rollout do not reconnect in lockstep.
 */
export function socketReconnectDelayMs(
  close: SocketClose,
  random: () => number = Math.random
): number {
  if (!close.opened) {
    return (
      random() *
      failedReconnectCeilingMs(
        close.failedAttempts,
        FAILED_RECONNECT_MAX_DELAY_MS
      )
    )
  }
  const windowMs =
    close.code === SERVICE_RESTART_CLOSE_CODE
      ? SERVICE_RESTART_RECONNECT_WINDOW_MS
      : OPENED_SOCKET_RECONNECT_WINDOW_MS
  return random() * windowMs
}

/** Deterministic backoff for a cookie-session socket that never opened. */
export function sessionRecoveryDelayMs(failedAttempts: number): number {
  return failedReconnectCeilingMs(failedAttempts, SESSION_RECOVERY_MAX_DELAY_MS)
}

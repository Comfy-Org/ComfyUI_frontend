const FIXED_RECONNECT_DELAY_MS = 300
// Under the 2 s before the Reconnecting toast shows, leaving room for the
// reconnect itself, so a spread-out reconnect does not show the toast.
const CLOUD_RECONNECT_WINDOW_MS = 1_500

interface ClosedSocket {
  readonly isCloud: boolean
  readonly opened: boolean
}

/**
 * Delay before reopening a closed socket: random within 1.5 seconds for an
 * opened Cloud socket, otherwise 300 ms.
 */
export function socketReconnectDelayMs(
  { isCloud, opened }: ClosedSocket,
  random: () => number = Math.random
): number {
  if (!isCloud || !opened) return FIXED_RECONNECT_DELAY_MS
  return random() * CLOUD_RECONNECT_WINDOW_MS
}

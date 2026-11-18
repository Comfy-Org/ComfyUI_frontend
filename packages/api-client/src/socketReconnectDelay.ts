const FIXED_RECONNECT_DELAY_MS = 300
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

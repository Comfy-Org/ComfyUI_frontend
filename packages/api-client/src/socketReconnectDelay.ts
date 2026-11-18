import { reconnectDelayMs } from './reconnectBackoff'

const FIXED_RECONNECT_DELAY_MS = 300
const CLOUD_RECONNECT_WINDOW_MS = 5_000

interface ClosedSocket {
  readonly isCloud: boolean
  readonly opened: boolean
  readonly failedConnects: number
}

/**
 * Delay before reopening a closed socket: random within five seconds for an
 * opened Cloud socket, 300 ms for an opened local socket, and an exponential
 * backoff over consecutive failed connects for a socket that never opened.
 */
export function socketReconnectDelayMs(
  { isCloud, opened, failedConnects }: ClosedSocket,
  random: () => number = Math.random
): number {
  if (!opened) return reconnectDelayMs(failedConnects)
  if (!isCloud) return FIXED_RECONNECT_DELAY_MS
  return random() * CLOUD_RECONNECT_WINDOW_MS
}

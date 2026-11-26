import { reconnectDelayMs } from './reconnectBackoff'

const FIXED_RECONNECT_DELAY_MS = 300
const CLOUD_RECONNECT_WINDOW_MS = 1_500

interface ClosedSocket {
  readonly isCloud: boolean
  readonly opened: boolean
  readonly failedConnects: number
}

/**
 * Delay before reopening a closed socket; backs off exponentially while the
 * socket keeps failing to open.
 */
export function socketReconnectDelayMs(
  { isCloud, opened, failedConnects }: ClosedSocket,
  random: () => number = Math.random
): number {
  if (!opened) return reconnectDelayMs(failedConnects)
  if (!isCloud) return FIXED_RECONNECT_DELAY_MS
  return random() * CLOUD_RECONNECT_WINDOW_MS
}

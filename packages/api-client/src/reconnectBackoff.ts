const BASE_DELAY_MS = 300
const MAX_DELAY_MS = 30_000
const JITTER_RATIO = 0.25

/**
 * Delay before the next realtime socket connect attempt. Attempt 0 keeps the
 * fixed base delay; later attempts double up to a cap, plus up to 25% jitter
 * so many tabs failing together do not retry in lockstep.
 */
export function reconnectDelayMs(attempt: number): number {
  if (attempt <= 0) return BASE_DELAY_MS
  const baseDelayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  return baseDelayMs + Math.floor(Math.random() * baseDelayMs * JITTER_RATIO)
}

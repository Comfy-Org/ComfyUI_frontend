const BASE_DELAY_MS = 300
const MAX_DELAY_MS = 30_000
const JITTER_RATIO = 0.25

export function reconnectDelayMs(attempt: number): number {
  if (attempt <= 0) return BASE_DELAY_MS
  const baseDelayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  return baseDelayMs + Math.floor(Math.random() * baseDelayMs * JITTER_RATIO)
}

/** Where a run is, as the Run button shows it. */
export type RunProgress =
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly percent: number }

/**
 * A run's progress read off the clock, for a job that reports none: queued
 * for `queueMs`, then counting towards 99% until `durationMs`.
 */
export function clockProgress(
  elapsedMs: number,
  durationMs: number,
  queueMs = 0
): RunProgress {
  if (elapsedMs < queueMs) return { kind: 'queued' }
  const share = (elapsedMs - queueMs) / Math.max(1, durationMs - queueMs)
  return {
    kind: 'running',
    percent: Math.max(0, Math.min(99, Math.floor(share * 100)))
  }
}

/**
 * Percent of one job's nodes that are done. A node counts as done once it
 * executed, came from cache, or its progress state says finished. Each
 * parallel job reads its own maps, so jobs never share one number.
 */
export function executedNodesPercent(
  nodes: Record<string, boolean> | undefined,
  fallback = 0,
  progressStates?: Record<string, { state: string }>
): number {
  const ids = new Set([
    ...Object.keys(nodes ?? {}),
    ...Object.keys(progressStates ?? {})
  ])
  if (ids.size === 0) return Math.round(fallback)
  let done = 0
  for (const id of ids) {
    if (nodes?.[id] || progressStates?.[id]?.state === 'finished') done += 1
  }
  return Math.round((done / ids.size) * 100)
}

/** Elapsed time as `m:ss`, the way a running job row shows it. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function formatRunningSubtitle(
  progress: number,
  elapsedMs?: number
): string {
  const percent = `${Math.round(progress)}%`
  return elapsedMs === undefined
    ? percent
    : `${percent} · ${formatElapsed(elapsedMs)}`
}

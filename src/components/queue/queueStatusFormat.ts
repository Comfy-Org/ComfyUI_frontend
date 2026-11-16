/**
 * Percent of a job's nodes that have executed or come from cache. Each
 * parallel job reads its own node map, so jobs never share one number.
 */
export function executedNodesPercent(
  nodes: Record<string, boolean> | undefined,
  fallback = 0
): number {
  const values = nodes ? Object.values(nodes) : []
  if (values.length === 0) return Math.round(fallback)
  return Math.round((values.filter(Boolean).length / values.length) * 100)
}

/** Elapsed time as `m:ss`, the way a running job row shows it. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

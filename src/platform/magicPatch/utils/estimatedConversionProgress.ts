export function estimatedConversionProgress(
  observedAt: number | undefined,
  remainingSeconds: number | undefined,
  now: number
): number | undefined {
  if (
    observedAt === undefined ||
    remainingSeconds === undefined ||
    !Number.isFinite(observedAt) ||
    !Number.isFinite(remainingSeconds) ||
    remainingSeconds < 0
  )
    return
  const elapsed = Math.max(0, now - observedAt) / 1000
  if (remainingSeconds === 0) return 99
  return Math.min(
    99,
    Math.floor((100 * elapsed) / (elapsed + remainingSeconds))
  )
}

interface GenerationTiming {
  readonly slug: string
  readonly environment: string
  readonly inputMode: string
  readonly lastSuccess?: {
    readonly status: string
    readonly elapsedMs?: number
  }
}

export function roundGenerationSeconds(elapsedMs: number): number | undefined {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return
  const seconds = elapsedMs / 1000
  const step = seconds <= 60 ? 10 : seconds <= 300 ? 30 : 60
  return Math.ceil(seconds / step) * step
}

export function generationTimeEstimates(
  rows: readonly GenerationTiming[]
): ReadonlyMap<string, number> {
  return new Map(
    rows.flatMap((row) => {
      if (
        row.environment !== 'prod' ||
        row.inputMode !== 'page-defaults' ||
        row.lastSuccess?.status !== 'passed'
      )
        return []
      const seconds = roundGenerationSeconds(row.lastSuccess.elapsedMs ?? 0)
      return seconds ? [[row.slug, seconds] as const] : []
    })
  )
}

export function estimatedGenerationProgress(
  elapsedMs: number,
  estimatedSeconds: number
): number {
  const ratio = Math.max(0, elapsedMs) / (estimatedSeconds * 1000)
  if (ratio <= 1) return ratio * 95
  return Math.min(99, 95 + 4 * (1 - Math.exp(-3 * (ratio - 1))))
}

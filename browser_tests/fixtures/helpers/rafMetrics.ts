export interface RafCollectorState {
  intervalsMs: number[]
  lastTimestamp: number | null
  requestId: number | null
  running: boolean
  startVisibility: DocumentVisibilityState
  visibilityChanged: boolean
  onVisibilityChange: () => void
}

export interface RafCollection {
  intervalsMs: number[]
  startVisibility: DocumentVisibilityState
  endVisibility: DocumentVisibilityState
  visibilityChanged: boolean
  boundaryTimedOut: boolean
}

export interface RafIntervalMetrics {
  rafIntervalCount: number
  rafIntervalP50Ms: number
  rafIntervalP95Ms: number
  rafIntervalP99Ms: number
  rafIntervalMaxMs: number
  rafIntervalsOver8_33Ms: number
  rafIntervalsOver16_67Ms: number
  rafIntervalsOver33_3Ms: number
  rafIntervalsOver50Ms: number
}

function percentile(sortedValues: number[], quantile: number): number {
  if (sortedValues.length === 0) return 0
  return sortedValues[Math.ceil(sortedValues.length * quantile) - 1]
}

export function summarizeRafIntervals(
  intervalsMs: number[]
): RafIntervalMetrics {
  const sorted = [...intervalsMs].sort((a, b) => a - b)
  return {
    rafIntervalCount: intervalsMs.length,
    rafIntervalP50Ms: percentile(sorted, 0.5),
    rafIntervalP95Ms: percentile(sorted, 0.95),
    rafIntervalP99Ms: percentile(sorted, 0.99),
    rafIntervalMaxMs: sorted.at(-1) ?? 0,
    rafIntervalsOver8_33Ms: intervalsMs.filter((value) => value > 8.33).length,
    rafIntervalsOver16_67Ms: intervalsMs.filter((value) => value > 16.67)
      .length,
    rafIntervalsOver33_3Ms: intervalsMs.filter((value) => value > 33.3).length,
    rafIntervalsOver50Ms: intervalsMs.filter((value) => value > 50).length
  }
}

export function getRafRejectionReason(
  collection: RafCollection | null
): string | null {
  if (!collection) return 'rAF collector missing at stop'
  if (collection.boundaryTimedOut) return 'rAF stop boundary timed out'
  if (
    collection.startVisibility !== 'visible' ||
    collection.endVisibility !== 'visible'
  ) {
    return `document visibility changed (${collection.startVisibility} to ${collection.endVisibility})`
  }
  if (collection.visibilityChanged) {
    return 'document visibility toggled during the measurement window'
  }
  if (
    collection.intervalsMs.some(
      (duration) => !Number.isFinite(duration) || duration <= 0
    )
  ) {
    return 'rAF timestamps were non-monotonic'
  }
  if (collection.intervalsMs.length === 0) {
    return 'measurement window contained no rAF intervals'
  }
  return null
}

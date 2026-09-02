export interface MetricStats {
  mean: number
  stddev: number
  min: number
  max: number
  n: number
}

export function computeStats(values: number[]): MetricStats {
  const n = values.length
  if (n === 0) return { mean: 0, stddev: 0, min: 0, max: 0, n: 0 }
  if (n === 1)
    return { mean: values[0], stddev: 0, min: values[0], max: values[0], n: 1 }

  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)

  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
    n
  }
}

export function zScore(value: number, stats: MetricStats): number | null {
  if (stats.stddev === 0 || stats.n < 2) return null
  return (value - stats.mean) / stats.stddev
}

export type Significance = 'regression' | 'improvement' | 'neutral' | 'noisy'

/**
 * Classify a metric change as regression/improvement/neutral/noisy.
 *
 * Uses both statistical significance (z-score) and practical significance
 * (effect size gate via minAbsDelta) to reduce false positives from
 * integer-quantized metrics with near-zero variance.
 */
export function classifyChange(
  z: number | null,
  historicalCV: number,
  absDelta?: number,
  minAbsDelta?: number
): Significance {
  if (historicalCV > 50) return 'noisy'
  if (z === null) return 'neutral'

  // Effect size gate: require minimum absolute change for count metrics
  // to avoid flagging e.g. 11→12 style recalcs as z=7.2 regression.
  if (minAbsDelta !== undefined && absDelta !== undefined) {
    if (Math.abs(absDelta) < minAbsDelta) return 'neutral'
  }

  if (z > 2) return 'regression'
  if (z < -2) return 'improvement'
  return 'neutral'
}

export function formatSignificance(
  sig: Significance,
  z: number | null
): string {
  switch (sig) {
    case 'regression':
      return `⚠️ z=${z!.toFixed(1)}`
    case 'improvement':
      return `z=${z!.toFixed(1)}`
    case 'noisy':
      return 'variance too high'
    case 'neutral':
      return z !== null ? `z=${z.toFixed(1)}` : '—'
  }
}

export function isNoteworthy(sig: Significance): boolean {
  return sig === 'regression'
}

const SPARK_CHARS = '▁▂▃▄▅▆▇█'

export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return SPARK_CHARS[3]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return values
    .map((v) => {
      if (range === 0) return SPARK_CHARS[3]
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1))
      return SPARK_CHARS[idx]
    })
    .join('')
}

export type TrendDirection = 'rising' | 'falling' | 'stable'

export function trendDirection(values: number[]): TrendDirection {
  if (values.length < 3) return 'stable'

  const half = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, half)
  const secondHalf = values.slice(-half)

  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  if (firstMean === 0) return secondMean > 0 ? 'rising' : 'stable'
  const changePct = ((secondMean - firstMean) / firstMean) * 100

  if (changePct > 10) return 'rising'
  if (changePct < -10) return 'falling'
  return 'stable'
}

export function trendArrow(dir: TrendDirection): string {
  switch (dir) {
    case 'rising':
      return '📈'
    case 'falling':
      return '📉'
    case 'stable':
      return '➡️'
  }
}

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

export function classifyChange(
  z: number | null,
  historicalCV: number
): Significance {
  if (historicalCV > 50) return 'noisy'
  if (z === null) return 'neutral'
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

/**
 * Convert a histogram (arbitrary number of bins) into an SVG path string.
 * Applies square-root scaling and normalizes using the 99.5th percentile
 * to avoid outlier spikes.
 */
export function histogramToPath(histogram: Uint32Array): string {
  const len = histogram.length
  if (len === 0) return ''

  const sqrtValues = new Float32Array(len)
  for (let i = 0; i < len; i++) sqrtValues[i] = Math.sqrt(histogram[i])

  const sorted = Array.from(sqrtValues).sort((a, b) => a - b)
  const max = sorted[Math.floor((len - 1) * 0.995)]
  if (max === 0) return ''

  const invMax = 1 / max
  const lastIdx = len - 1
  const parts: string[] = ['M0,1']
  for (let i = 0; i < len; i++) {
    const x = lastIdx === 0 ? 0.5 : i / lastIdx
    const y = 1 - Math.min(1, sqrtValues[i] * invMax)
    parts.push(`L${x},${y}`)
  }
  parts.push('L1,1 Z')
  return parts.join(' ')
}

export interface GestureSample {
  steps: number
  frames: number[]
  intervals: number[]
}

export interface FrameStats {
  frames: number
  median: number
  p95: number
  max: number
  medianFps: number
  mainThreadMedian: number
  mainThreadP95: number
}

function nearestRank(sorted: readonly number[], percentile: number) {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]
}

export function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function heaviest(values: readonly number[], count: number) {
  return [...values]
    .sort((a, b) => b - a)
    .slice(0, count)
    .sort((a, b) => a - b)
}

export function gestureFrameStats(sample: GestureSample): FrameStats {
  const frameTimes = heaviest(sample.intervals, sample.steps)
  const costs = heaviest(sample.frames, sample.steps)
  if (frameTimes.length === 0 || costs.length === 0)
    throw new Error('the gesture produced no measurable frames')
  return {
    frames: frameTimes.length,
    median: median(frameTimes),
    p95: nearestRank(frameTimes, 95),
    max: frameTimes[frameTimes.length - 1],
    medianFps: round(1000 / median(frameTimes)),
    mainThreadMedian: round(median(costs)),
    mainThreadP95: round(nearestRank(costs, 95))
  }
}

export function round(value: number, digits = 1) {
  return Number(value.toFixed(digits))
}

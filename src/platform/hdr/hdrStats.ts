export interface ImageStats {
  min: number
  max: number
  mean: number
  stdDev: number
  nanCount: number
  infCount: number
}

export function computeImageStats(
  read: (index: number) => number,
  length: number,
  channels: number
): ImageStats {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  let nanCount = 0
  let infCount = 0

  for (let i = 0; i < length; i++) {
    const value = read(i)
    if (Number.isNaN(value)) {
      nanCount++
      continue
    }
    if (!Number.isFinite(value)) {
      infCount++
      continue
    }
    if (channels === 4 && i % channels === 3) continue
    if (value < min) min = value
    if (value > max) max = value
    sum += value
    sumSq += value * value
    count++
  }

  if (count === 0) {
    return { min: 0, max: 0, mean: 0, stdDev: 0, nanCount, infCount }
  }

  const mean = sum / count
  const variance = Math.max(0, sumSq / count - mean * mean)
  return { min, max, mean, stdDev: Math.sqrt(variance), nanCount, infCount }
}

export function computeLuminancePercentile(
  read: (index: number) => number,
  length: number,
  channels: number,
  percentile: number,
  maxSamples = 65_536
): number {
  const pixelCount = Math.floor(length / channels)
  const stride = Math.max(1, Math.floor(pixelCount / maxSamples))
  const samples: number[] = []

  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const i = pixel * channels
    const r = read(i)
    const value =
      channels >= 3
        ? 0.2126 * r + 0.7152 * read(i + 1) + 0.0722 * read(i + 2)
        : r
    if (Number.isFinite(value)) samples.push(value)
  }

  if (samples.length === 0) return 0
  samples.sort((a, b) => a - b)
  const rank = Math.min(
    samples.length - 1,
    Math.floor(percentile * samples.length)
  )
  return samples[rank]
}

export interface ChannelHistograms {
  r: Uint32Array
  g: Uint32Array
  b: Uint32Array
  a: Uint32Array | null
  luminance: Uint32Array
}

export function computeChannelHistograms(
  read: (index: number) => number,
  length: number,
  channels: number,
  bins = 256
): ChannelHistograms {
  const last = bins - 1
  const r = new Uint32Array(bins)
  const g = new Uint32Array(bins)
  const b = new Uint32Array(bins)
  const luminance = new Uint32Array(bins)
  const a = channels === 4 ? new Uint32Array(bins) : null

  const accumulate = (target: Uint32Array, value: number) => {
    if (Number.isNaN(value)) return
    const bin = Math.floor(Math.max(0, value) * bins)
    target[bin > last ? last : bin]++
  }

  for (let i = 0; i + channels - 1 < length; i += channels) {
    const rv = read(i)
    const gv = channels >= 3 ? read(i + 1) : rv
    const bv = channels >= 3 ? read(i + 2) : rv
    accumulate(r, rv)
    accumulate(g, gv)
    accumulate(b, bv)
    if (a) accumulate(a, read(i + 3))
    accumulate(
      luminance,
      channels >= 3 ? 0.2126 * rv + 0.7152 * gv + 0.0722 * bv : rv
    )
  }

  return { r, g, b, a, luminance }
}

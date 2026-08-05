export type Rgb = [number, number, number]

const LUT_SIZE = 256
const SCALE = LUT_SIZE - 1

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function exposureScale(exposure: number, black: number): number {
  const diff = Math.abs(Math.pow(2, -exposure) - black)
  return 1 / (diff > 0 ? diff : 1 / 1024)
}

export function kelvinToRgb(k: number): Rgb {
  const kelvin = k / 100
  let r: number
  let g: number
  let b: number
  if (kelvin <= 66) {
    r = 1
    g = clamp01(
      0.39008157876901960784 * Math.log(kelvin) - 0.63184144378862745098
    )
  } else {
    const t = Math.max(kelvin - 60, 0)
    r = clamp01(1.29293618606274509804 * Math.pow(t, -0.1332047592))
    g = clamp01(1.12989086089529411765 * Math.pow(t, -0.0755148492))
  }
  if (kelvin >= 66) b = 1
  else if (kelvin <= 19) b = 0
  else
    b = clamp01(0.5432067891101960784 * Math.log(kelvin - 10) - 1.19625408914)
  return [r, g, b]
}

export type CurvePoint = [number, number]

function quant4(v: number): number {
  return Math.round(v * 10000) / 10000
}

function clipTrunc(v: number): number {
  return Math.min(255, Math.max(0, Math.trunc(v)))
}

export function sanitizeCurvePoints(raw: string): CurvePoint[] | null {
  if (!(raw || '').trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const dedup = new Map<number, number>()
  for (const p of parsed) {
    if (!Array.isArray(p) || p.length < 2) continue
    const x = Number(p[0])
    const y = Number(p[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    dedup.set(quant4(clamp01(x)), quant4(clamp01(y)))
  }
  if (dedup.size < 2) return null
  return [...dedup.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, y]) => [x, y] as CurvePoint)
}

function usablePoints(pts: CurvePoint[] | null): CurvePoint[] | null {
  if (!pts) return null
  const out: CurvePoint[] = []
  let lastIdx = -1
  for (const pt of pts) {
    const idx = Math.trunc(pt[0] * SCALE)
    if (out.length > 0 && idx <= lastIdx) continue
    out.push(pt)
    lastIdx = idx
  }
  return out
}

export function interpolateNatural(points: CurvePoint[] | null): Uint8Array {
  const y = new Uint8Array(LUT_SIZE)
  const n = points?.length ?? 0
  if (!points || n === 0) {
    for (let i = 0; i < LUT_SIZE; i++) y[i] = i
    return y
  }
  if (n === 1) {
    y.fill(clipTrunc(points[0][1] * SCALE))
    return y
  }

  const h = new Float64Array(n - 1)
  for (let i = 0; i < n - 1; i++) h[i] = points[i + 1][0] - points[i][0]

  const r = new Float64Array(n)
  for (let i = 1; i < n - 1; i++) {
    const yp = points[i - 1][1]
    const yc = points[i][1]
    const yn = points[i + 1][1]
    r[i] = 6 * ((yn - yc) / h[i] - (yc - yp) / h[i - 1])
  }

  const bd = new Float64Array(n)
  const md = new Float64Array(n)
  const ad = new Float64Array(n)
  md[0] = 1
  md[n - 1] = 1
  for (let i = 1; i < n - 1; i++) {
    bd[i] = h[i - 1]
    md[i] = 2 * (h[i - 1] + h[i])
    ad[i] = h[i]
  }
  for (let i = 1; i < n; i++) {
    const den = md[i] - bd[i] * ad[i - 1]
    const k = den ? 1 / den : 1
    ad[i] *= k
    r[i] = (r[i] - bd[i] * r[i - 1]) * k
  }
  for (let i = n - 2; i >= 0; i--) r[i] = r[i] - ad[i] * r[i + 1]

  for (let i = 0; i < Math.trunc(points[0][0] * SCALE); i++) {
    y[i] = clipTrunc(points[0][1] * SCALE)
  }

  for (let i = 0; i < n - 1; i++) {
    const yc = points[i][1]
    const yn = points[i + 1][1]
    const a = yc
    const b =
      (yn - yc) / h[i] - (h[i] * r[i]) / 2 - (h[i] * (r[i + 1] - r[i])) / 6
    const c = r[i] / 2
    const d = (r[i + 1] - r[i]) / (6 * h[i])
    const xStart = Math.trunc(points[i][0] * SCALE)
    const xEnd = Math.trunc(points[i + 1][0] * SCALE)
    for (let x = xStart; x <= xEnd; x++) {
      const xx = (x - xStart) / SCALE
      const yy = a + b * xx + c * xx * xx + d * xx * xx * xx
      y[x] = clipTrunc(yy * SCALE)
    }
  }

  for (let i = Math.trunc(points[n - 1][0] * SCALE); i < LUT_SIZE; i++) {
    y[i] = clipTrunc(points[n - 1][1] * SCALE)
  }

  return y
}

export interface CurvesLuts {
  red: Uint8Array
  green: Uint8Array
  blue: Uint8Array
}

export interface CurveChannels {
  master?: string
  red?: string
  green?: string
  blue?: string
}

export function buildCurvesLuts(p: CurveChannels): CurvesLuts {
  const pick = (raw: string | undefined): CurvePoint[] | null =>
    usablePoints(sanitizeCurvePoints(raw ?? ''))
  const red = interpolateNatural(pick(p.red))
  const green = interpolateNatural(pick(p.green))
  const blue = interpolateNatural(pick(p.blue))
  const master = pick(p.master)
  if (master) {
    const m = interpolateNatural(master)
    for (const lut of [red, green, blue]) {
      for (let i = 0; i < LUT_SIZE; i++) lut[i] = m[lut[i]]
    }
  }
  return { red, green, blue }
}

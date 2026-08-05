import { generateId } from '../id'
import { applyLayerFxChainGpu } from './fxGpu'
import type { Bitmap } from './place'

export type LayerFxOp =
  | 'drop-shadow'
  | 'gaussian-blur'
  | 'unsharp-mask'
  | 'median-blur'
  | 'vignette'
  | 'emboss'
  | 'pixelate'
  | 'noise'
  | 'desaturate'

export interface LayerFxData {
  id: string
  op: LayerFxOp
  params: Record<string, number>
  enabled: boolean
  opacity: number
}

export interface LayerFxParamDef {
  key: string
  min: number
  max: number
  default: number
  step?: number
  color?: boolean
}

export const LAYER_FX_DEFS: Record<LayerFxOp, LayerFxParamDef[]> = {
  'drop-shadow': [
    { key: 'x', min: -100, max: 100, default: 8, step: 1 },
    { key: 'y', min: -100, max: 100, default: 8, step: 1 },
    { key: 'stdDev', min: 0, max: 60, default: 6, step: 1 },
    { key: 'shadowOpacity', min: 0, max: 1, default: 0.6, step: 0.01 },
    { key: 'color', min: 0, max: 0xffffff, default: 0, color: true }
  ],
  'gaussian-blur': [
    { key: 'stdDev', min: 0.5, max: 60, default: 4, step: 0.5 }
  ],
  'unsharp-mask': [
    { key: 'stdDev', min: 0.5, max: 40, default: 3, step: 0.5 },
    { key: 'scale', min: 0, max: 5, default: 0.5, step: 0.05 }
  ],
  'median-blur': [{ key: 'radius', min: 1, max: 20, default: 3, step: 1 }],
  vignette: [
    { key: 'radius', min: 0, max: 3, default: 1.2, step: 0.05 },
    { key: 'softness', min: 0.05, max: 3, default: 0.8, step: 0.05 },
    { key: 'gamma', min: 0.1, max: 4, default: 1, step: 0.05 }
  ],
  emboss: [
    { key: 'azimuth', min: 0, max: 360, default: 30, step: 1 },
    { key: 'elevation', min: 0, max: 90, default: 45, step: 1 },
    { key: 'depth', min: 1, max: 60, default: 20, step: 1 }
  ],
  pixelate: [{ key: 'size', min: 2, max: 64, default: 8, step: 1 }],
  noise: [{ key: 'amount', min: 0, max: 1, default: 0.2, step: 0.01 }],
  desaturate: [{ key: 'amount', min: 0, max: 1, default: 1, step: 0.01 }]
}

export const LAYER_FX_OPS = Object.keys(LAYER_FX_DEFS) as LayerFxOp[]

export function defaultFxParams(op: LayerFxOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of LAYER_FX_DEFS[op]) out[def.key] = def.default
  return out
}

export function createLayerFx(op: LayerFxOp): LayerFxData {
  return {
    id: generateId('fx'),
    op,
    params: defaultFxParams(op),
    enabled: true,
    opacity: 1
  }
}

export function normalizeLayerFx(raw: unknown): LayerFxData[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LayerFxData[] = []
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>
    const op = r.op as LayerFxOp
    if (typeof op !== 'string' || !(op in LAYER_FX_DEFS)) continue
    const params = defaultFxParams(op)
    const rp = (r.params ?? {}) as Record<string, unknown>
    for (const key of Object.keys(params)) {
      if (typeof rp[key] === 'number' && isFinite(rp[key] as number))
        params[key] = rp[key] as number
    }
    out.push({
      id: typeof r.id === 'string' ? r.id : generateId('fx'),
      op,
      params,
      enabled: r.enabled !== false,
      opacity:
        typeof r.opacity === 'number' ? Math.max(0, Math.min(1, r.opacity)) : 1
    })
  }
  return out.length ? out : undefined
}

export function fxStamp(fx: LayerFxData[]): string {
  return fx
    .map(
      (f) =>
        `${f.op}:${f.enabled ? 1 : 0}:${f.opacity}:${Object.keys(f.params)
          .sort()
          .map((k) => `${k}=${f.params[k]}`)
          .join(',')}`
    )
    .join(';')
}

function fxPad(f: LayerFxData): number {
  if (!f.enabled) return 0
  if (f.op === 'drop-shadow') {
    return Math.ceil(
      3 * (f.params.stdDev ?? 0) +
        Math.max(Math.abs(f.params.x ?? 0), Math.abs(f.params.y ?? 0))
    )
  }
  if (f.op === 'gaussian-blur') return Math.ceil(3 * (f.params.stdDev ?? 0))
  return 0
}

export function gaussianIsNoop(sigma: number): boolean {
  if (sigma <= 0) return true
  return boxSizes(sigma).every((size) => Math.round((size - 1) / 2) < 1)
}

export function blurBoxRadii(sigma: number): number[] {
  return boxSizes(sigma)
    .map((size) => Math.round((size - 1) / 2))
    .filter((r) => r >= 1)
}

function boxSizes(sigma: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / 3 + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const m = Math.round(
    (12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4)
  )
  return [0, 1, 2].map((i) => (i < m ? wl : wu))
}

function blurChannelPass(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  r: number
): void {
  const norm = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let i = -r; i <= r; i++)
      acc += src[row + Math.max(0, Math.min(w - 1, i))]
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * norm
      acc +=
        src[row + Math.max(0, Math.min(w - 1, x + r + 1))] -
        src[row + Math.max(0, Math.min(w - 1, x - r))]
    }
  }
}

function gaussianBlurPremul(img: ImageData, sigma: number): ImageData {
  const w = img.width
  const h = img.height
  const n = w * h
  const ch: Float32Array[] = [0, 1, 2, 3].map(() => new Float32Array(n))
  for (let p = 0; p < n; p++) {
    const a = img.data[p * 4 + 3] / 255
    ch[0][p] = (img.data[p * 4] / 255) * a
    ch[1][p] = (img.data[p * 4 + 1] / 255) * a
    ch[2][p] = (img.data[p * 4 + 2] / 255) * a
    ch[3][p] = a
  }
  const sizes = boxSizes(sigma)
  const tmp = new Float32Array(n)
  const tr = new Float32Array(n)
  for (const c of ch) {
    for (const size of sizes) {
      const r = Math.round((size - 1) / 2)
      if (r < 1) continue
      blurChannelPass(c, tmp, w, h, r)
      c.set(tmp)
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) tr[x * h + y] = c[y * w + x]
    for (const size of sizes) {
      const r = Math.round((size - 1) / 2)
      if (r < 1) continue
      blurChannelPass(tr, tmp, h, w, r)
      tr.set(tmp)
    }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) c[y * w + x] = tr[x * h + y]
  }
  const out = new ImageData(w, h)
  for (let p = 0; p < n; p++) {
    const a = ch[3][p]
    out.data[p * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    const inv = a > 1e-5 ? 1 / a : 0
    out.data[p * 4] = Math.round(Math.max(0, Math.min(1, ch[0][p] * inv)) * 255)
    out.data[p * 4 + 1] = Math.round(
      Math.max(0, Math.min(1, ch[1][p] * inv)) * 255
    )
    out.data[p * 4 + 2] = Math.round(
      Math.max(0, Math.min(1, ch[2][p] * inv)) * 255
    )
  }
  return out
}

function applyDropShadow(
  img: ImageData,
  params: Record<string, number>
): ImageData {
  const w = img.width
  const h = img.height
  const shadow = new ImageData(w, h)
  const color = params.color ?? 0
  const cr = (color >> 16) & 255
  const cg = (color >> 8) & 255
  const cb = color & 255
  const so = params.shadowOpacity ?? 0.6
  for (let p = 0; p < w * h; p++) {
    shadow.data[p * 4] = cr
    shadow.data[p * 4 + 1] = cg
    shadow.data[p * 4 + 2] = cb
    shadow.data[p * 4 + 3] = Math.round(img.data[p * 4 + 3] * so)
  }
  const blurred =
    (params.stdDev ?? 0) > 0
      ? gaussianBlurPremul(shadow, params.stdDev)
      : shadow
  const dx = Math.round(params.x ?? 0)
  const dy = Math.round(params.y ?? 0)
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - dx
      const sy = y - dy
      const i = (y * w + x) * 4
      let br = 0,
        bg = 0,
        bb = 0,
        ba = 0
      if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
        const j = (sy * w + sx) * 4
        br = blurred.data[j]
        bg = blurred.data[j + 1]
        bb = blurred.data[j + 2]
        ba = blurred.data[j + 3] / 255
      }
      const fa = img.data[i + 3] / 255
      const outA = fa + ba * (1 - fa)
      if (outA <= 0) continue
      out.data[i] = Math.round((img.data[i] * fa + br * ba * (1 - fa)) / outA)
      out.data[i + 1] = Math.round(
        (img.data[i + 1] * fa + bg * ba * (1 - fa)) / outA
      )
      out.data[i + 2] = Math.round(
        (img.data[i + 2] * fa + bb * ba * (1 - fa)) / outA
      )
      out.data[i + 3] = Math.round(outA * 255)
    }
  }
  return out
}

function applyMedian(img: ImageData, radius: number): ImageData {
  const w = img.width
  const h = img.height
  const r = Math.max(1, Math.min(20, Math.round(radius)))
  const widths = new Int32Array(2 * r + 1)
  for (let dy = -r; dy <= r; dy++)
    widths[dy + r] = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
  const out = new ImageData(w, h)
  const hist = [
    new Int32Array(256),
    new Int32Array(256),
    new Int32Array(256),
    new Int32Array(256)
  ]
  const clampX = (x: number): number => Math.max(0, Math.min(w - 1, x))
  const clampY = (y: number): number => Math.max(0, Math.min(h - 1, y))
  for (let y = 0; y < h; y++) {
    for (const hh of hist) hh.fill(0)
    let count = 0
    for (let dy = -r; dy <= r; dy++) {
      const cw = widths[dy + r]
      const yy = clampY(y + dy)
      for (let dx = -cw; dx <= cw; dx++) {
        const i = (yy * w + clampX(dx)) * 4
        for (let c = 0; c < 4; c++) hist[c][img.data[i + c]]++
        count++
      }
    }
    for (let x = 0; x < w; x++) {
      const half = count / 2
      const o = (y * w + x) * 4
      for (let c = 0; c < 4; c++) {
        let acc = 0
        let v = 0
        while (v < 255 && acc + hist[c][v] < half) {
          acc += hist[c][v]
          v++
        }
        out.data[o + c] = v
      }
      if (x + 1 < w) {
        for (let dy = -r; dy <= r; dy++) {
          const cw = widths[dy + r]
          const yy = clampY(y + dy)
          const remI = (yy * w + clampX(x - cw)) * 4
          const addI = (yy * w + clampX(x + 1 + cw)) * 4
          for (let c = 0; c < 4; c++) {
            hist[c][img.data[remI + c]]--
            hist[c][img.data[addI + c]]++
          }
        }
      }
    }
  }
  return out
}

function applyVignette(img: ImageData, params: Record<string, number>): void {
  const w = img.width
  const h = img.height
  const radius = params.radius ?? 1.2
  const softness = Math.max(0.001, params.softness ?? 0.8)
  const gamma = Math.max(0.01, params.gamma ?? 1)
  const cx = w / 2
  const cy = h / 2
  const scale = 1 / (0.5 * Math.hypot(w, h))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) * scale
      const dy = (y + 0.5 - cy) * scale
      const d = Math.sqrt(dx * dx + dy * dy)
      let v = (radius - d) / softness
      v = Math.max(0, Math.min(1, v))
      v = Math.pow(v, gamma)
      const i = (y * w + x) * 4
      img.data[i] = Math.round(img.data[i] * v)
      img.data[i + 1] = Math.round(img.data[i + 1] * v)
      img.data[i + 2] = Math.round(img.data[i + 2] * v)
    }
  }
}

function applyEmboss(
  img: ImageData,
  params: Record<string, number>
): ImageData {
  const w = img.width
  const h = img.height
  const az = ((params.azimuth ?? 30) * Math.PI) / 180
  const el = ((params.elevation ?? 45) * Math.PI) / 180
  const depth = Math.max(1, params.depth ?? 20)
  const lx = Math.cos(az) * Math.cos(el)
  const ly = Math.sin(az) * Math.cos(el)
  const lz = Math.sin(el)
  const nzBase = (6 * 255) / depth
  const luma = new Float32Array(w * h)
  for (let p = 0; p < w * h; p++) {
    luma[p] =
      0.2126 * img.data[p * 4] +
      0.7152 * img.data[p * 4 + 1] +
      0.0722 * img.data[p * 4 + 2]
  }
  const out = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = Math.max(0, x - 1)
      const xr = Math.min(w - 1, x + 1)
      const yu = Math.max(0, y - 1)
      const yd = Math.min(h - 1, y + 1)
      const nx = luma[y * w + xl] - luma[y * w + xr]
      const ny = luma[yu * w + x] - luma[yd * w + x]
      const len = Math.sqrt(nx * nx + ny * ny + nzBase * nzBase)
      let shade = (nx * lx + ny * ly + nzBase * lz) / len
      shade = Math.max(0, Math.min(1, shade))
      const i = (y * w + x) * 4
      const v = Math.round(shade * 255)
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v
      out.data[i + 3] = img.data[i + 3]
    }
  }
  return out
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0xffffffff
  }
}

function applyNoise(img: ImageData, amount: number): void {
  const rand = seededRandom(0x9e3779b9)
  const range = amount * 255
  for (let p = 0; p < img.width * img.height; p++) {
    const i = p * 4
    if (img.data[i + 3] === 0) continue
    const n = (rand() - 0.5) * range
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
}

function applyPixelate(img: ImageData, size: number): void {
  const w = img.width
  const h = img.height
  const s = Math.max(2, Math.round(size))
  for (let by = 0; by < h; by += s) {
    for (let bx = 0; bx < w; bx += s) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        cnt = 0
      for (let y = by; y < Math.min(h, by + s); y++) {
        for (let x = bx; x < Math.min(w, bx + s); x++) {
          const i = (y * w + x) * 4
          r += img.data[i]
          g += img.data[i + 1]
          b += img.data[i + 2]
          a += img.data[i + 3]
          cnt++
        }
      }
      r = Math.round(r / cnt)
      g = Math.round(g / cnt)
      b = Math.round(b / cnt)
      a = Math.round(a / cnt)
      for (let y = by; y < Math.min(h, by + s); y++) {
        for (let x = bx; x < Math.min(w, bx + s); x++) {
          const i = (y * w + x) * 4
          img.data[i] = r
          img.data[i + 1] = g
          img.data[i + 2] = b
          img.data[i + 3] = a
        }
      }
    }
  }
}

function applyOne(img: ImageData, f: LayerFxData): ImageData {
  switch (f.op) {
    case 'gaussian-blur':
      return (f.params.stdDev ?? 0) > 0
        ? gaussianBlurPremul(img, f.params.stdDev)
        : img
    case 'unsharp-mask': {
      const blurred = gaussianBlurPremul(
        img,
        Math.max(0.5, f.params.stdDev ?? 3)
      )
      const scale = f.params.scale ?? 0.5
      const out = new ImageData(img.width, img.height)
      for (let p = 0; p < img.width * img.height; p++) {
        const i = p * 4
        for (let c = 0; c < 3; c++) {
          out.data[i + c] = Math.max(
            0,
            Math.min(
              255,
              img.data[i + c] + (img.data[i + c] - blurred.data[i + c]) * scale
            )
          )
        }
        out.data[i + 3] = img.data[i + 3]
      }
      return out
    }
    case 'median-blur':
      return applyMedian(img, f.params.radius ?? 3)
    case 'drop-shadow':
      return applyDropShadow(img, f.params)
    case 'vignette':
      applyVignette(img, f.params)
      return img
    case 'emboss':
      return applyEmboss(img, f.params)
    case 'noise':
      applyNoise(img, f.params.amount ?? 0.2)
      return img
    case 'pixelate':
      applyPixelate(img, f.params.size ?? 8)
      return img
    case 'desaturate': {
      const amt = Math.max(0, Math.min(1, f.params.amount ?? 1))
      for (let p = 0; p < img.width * img.height; p++) {
        const i = p * 4
        const l =
          0.2126 * img.data[i] +
          0.7152 * img.data[i + 1] +
          0.0722 * img.data[i + 2]
        img.data[i] = Math.round(img.data[i] + (l - img.data[i]) * amt)
        img.data[i + 1] = Math.round(
          img.data[i + 1] + (l - img.data[i + 1]) * amt
        )
        img.data[i + 2] = Math.round(
          img.data[i + 2] + (l - img.data[i + 2]) * amt
        )
      }
      return img
    }
  }
}

export function applyLayerFxChain(
  bitmap: Bitmap,
  fx: LayerFxData[]
): { canvas: HTMLCanvasElement; pad: number } | null {
  const active = fx.filter((f) => f.enabled)
  const pad = active.reduce((n, f) => n + fxPad(f), 0)
  const w = bitmap.width + 2 * pad
  const h = bitmap.height + 2 * pad
  if (w > 16384 || h > 16384) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) return null
  g.drawImage(bitmap, pad, pad)
  let img = g.getImageData(0, 0, w, h)
  for (const f of active) {
    const before = f.opacity < 1 ? new Uint8ClampedArray(img.data) : null
    img = applyOne(img, f)
    if (before) {
      const t = f.opacity
      const d = img.data
      for (let p = 0; p < d.length; p += 4) {
        const aA = before[p + 3] / 255
        const aB = d[p + 3] / 255
        const na = aA + (aB - aA) * t
        if (na <= 1e-5) {
          d[p] = d[p + 1] = d[p + 2] = 0
          d[p + 3] = 0
          continue
        }
        for (let c = 0; c < 3; c++) {
          const pm =
            before[p + c] * aA + (d[p + c] * aB - before[p + c] * aA) * t
          d[p + c] = Math.round(pm / na)
        }
        d[p + 3] = Math.round(na * 255)
      }
    }
  }
  g.putImageData(img, 0, 0)
  return { canvas, pad }
}

interface FxCacheEntry {
  stamp: string
  canvas: HTMLCanvasElement
  pad: number
}

const fxCache = new Map<string, FxCacheEntry>()
const FX_CACHE_MAX = 64

export function getFxProcessed(
  cacheKey: string,
  contentStamp: string,
  bitmap: Bitmap,
  fx: LayerFxData[]
): { canvas: HTMLCanvasElement; pad: number } | null {
  const stamp = `${contentStamp}|${bitmap.width}x${bitmap.height}|${fxStamp(fx)}`
  const entry = fxCache.get(cacheKey)
  if (entry && entry.stamp === stamp)
    return { canvas: entry.canvas, pad: entry.pad }
  const active = fx.filter((f) => f.enabled)
  const pad = active.reduce((n, f) => n + fxPad(f), 0)
  const gpuCanvas =
    bitmap.width + 2 * pad <= 16384 && bitmap.height + 2 * pad <= 16384
      ? applyLayerFxChainGpu(bitmap, active, pad)
      : null
  const result = gpuCanvas
    ? { canvas: gpuCanvas, pad }
    : applyLayerFxChain(bitmap, fx)
  if (!result) return null
  if (fxCache.size >= FX_CACHE_MAX && !fxCache.has(cacheKey)) {
    const first = fxCache.keys().next().value
    if (first !== undefined) fxCache.delete(first)
  }
  fxCache.set(cacheKey, { stamp, canvas: result.canvas, pad: result.pad })
  return result
}

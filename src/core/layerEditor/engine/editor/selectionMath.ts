import type { Rect, Vec2 } from '../node'

export type SelectionOp = 'replace' | 'add' | 'subtract' | 'intersect'

export interface GrayMask {
  data: Float32Array
  width: number
  height: number
}

export function emptyMask(width: number, height: number): GrayMask {
  return { data: new Float32Array(width * height), width, height }
}

export function maskFromCanvas(canvas: HTMLCanvasElement): GrayMask | null {
  const g = canvas.getContext('2d')
  if (!g) return null
  const img = g.getImageData(0, 0, canvas.width, canvas.height)
  const mask = emptyMask(canvas.width, canvas.height)
  for (let p = 0; p < mask.data.length; p++)
    mask.data[p] = img.data[p * 4] / 255
  return mask
}

export function maskToCanvas(mask: GrayMask): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = mask.width
  c.height = mask.height
  const g = c.getContext('2d')
  if (!g) return null
  const img = g.createImageData(mask.width, mask.height)
  for (let p = 0; p < mask.data.length; p++) {
    const v = Math.round(Math.max(0, Math.min(1, mask.data[p])) * 255)
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = v
    img.data[p * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return c
}

export function combineMasks(
  base: GrayMask,
  addOn: GrayMask,
  op: SelectionOp
): GrayMask {
  const out = emptyMask(base.width, base.height)
  const a = base.data
  const b = addOn.data
  const d = out.data
  switch (op) {
    case 'replace':
      d.set(b)
      break
    case 'add':
      for (let p = 0; p < d.length; p++) d[p] = Math.min(a[p] + b[p], 1)
      break
    case 'subtract':
      for (let p = 0; p < d.length; p++) d[p] = Math.max(a[p] - b[p], 0)
      break
    case 'intersect':
      for (let p = 0; p < d.length; p++) d[p] = Math.min(a[p], b[p])
      break
  }
  return out
}

export function maskBounds(mask: GrayMask): Rect | null {
  let minX = mask.width
  let minY = mask.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[row + x] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function isMaskEmpty(mask: GrayMask): boolean {
  for (let p = 0; p < mask.data.length; p++) if (mask.data[p] > 0) return false
  return true
}

function vanHerk(
  line: Float32Array,
  out: Float32Array,
  n: number,
  radius: number,
  pick: (a: number, b: number) => number,
  pad: number
): void {
  const w = 2 * radius + 1
  const fwd = new Float32Array(n)
  const bwd = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    fwd[i] = i % w === 0 ? line[i] : pick(fwd[i - 1], line[i])
  }
  for (let i = n - 1; i >= 0; i--) {
    bwd[i] =
      i % w === w - 1 || i === n - 1 ? line[i] : pick(bwd[i + 1], line[i])
  }
  for (let i = 0; i < n; i++) {
    const lo = i - radius
    const hi = i + radius
    const a = hi < n ? fwd[hi] : pad
    const b = lo >= 0 ? bwd[lo] : pad
    out[i] =
      hi < n && lo >= 0
        ? pick(a, b)
        : pick(pick(hi < n ? a : pad, lo >= 0 ? b : pad), pad)
  }
}

function verticalFilter(
  mask: GrayMask,
  radius: number,
  pick: (a: number, b: number) => number,
  pad: number
): GrayMask {
  const out = emptyMask(mask.width, mask.height)
  const col = new Float32Array(mask.height)
  const res = new Float32Array(mask.height)
  for (let x = 0; x < mask.width; x++) {
    for (let y = 0; y < mask.height; y++) col[y] = mask.data[y * mask.width + x]
    vanHerk(col, res, mask.height, radius, pick, pad)
    for (let y = 0; y < mask.height; y++) out.data[y * mask.width + x] = res[y]
  }
  return out
}

function ellipticalFilter(
  mask: GrayMask,
  radius: number,
  pick: (a: number, b: number) => number,
  pad: number
): GrayMask {
  const r = Math.max(1, Math.round(radius))
  const circ = new Int32Array(2 * r + 1)
  for (let i = -r; i <= r; i++) {
    const t = Math.max(0, Math.abs(i) - 0.5)
    circ[i + r] = Math.round(Math.sqrt(Math.max(0, r * r - t * t)))
  }
  const byHeight = new Map<number, GrayMask>()
  for (const h of circ) {
    if (!byHeight.has(h))
      byHeight.set(h, h === 0 ? mask : verticalFilter(mask, h, pick, pad))
  }
  const out = emptyMask(mask.width, mask.height)
  for (let y = 0; y < mask.height; y++) {
    const row = y * mask.width
    for (let x = 0; x < mask.width; x++) {
      let v: number | null = null
      for (let i = -r; i <= r; i++) {
        const xx = x + i
        const src =
          xx >= 0 && xx < mask.width
            ? byHeight.get(circ[i + r])!.data[row + xx]
            : pad
        v = v === null ? src : pick(v, src)
      }
      out.data[row + x] = v ?? pad
    }
  }
  return out
}

function cropMask(mask: GrayMask, r: Rect): GrayMask {
  const out = emptyMask(r.w, r.h)
  for (let y = 0; y < r.h; y++) {
    const src = (r.y + y) * mask.width + r.x
    out.data.set(mask.data.subarray(src, src + r.w), y * r.w)
  }
  return out
}

function pasteMask(
  sub: GrayMask,
  r: Rect,
  width: number,
  height: number
): GrayMask {
  const out = emptyMask(width, height)
  for (let y = 0; y < r.h; y++) {
    out.data.set(
      sub.data.subarray(y * r.w, y * r.w + r.w),
      (r.y + y) * width + r.x
    )
  }
  return out
}

function withBounds(
  mask: GrayMask,
  bounds: Rect | null | undefined,
  pad: number,
  run: (m: GrayMask) => GrayMask
): GrayMask {
  if (!bounds) return run(mask)
  const x0 = Math.max(0, Math.floor(bounds.x - pad))
  const y0 = Math.max(0, Math.floor(bounds.y - pad))
  const x1 = Math.min(mask.width, Math.ceil(bounds.x + bounds.w + pad))
  const y1 = Math.min(mask.height, Math.ceil(bounds.y + bounds.h + pad))
  if (x1 <= x0 || y1 <= y0) return emptyMask(mask.width, mask.height)
  const rect: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (
    rect.x === 0 &&
    rect.y === 0 &&
    rect.w === mask.width &&
    rect.h === mask.height
  )
    return run(mask)
  return pasteMask(run(cropMask(mask, rect)), rect, mask.width, mask.height)
}

export function growMask(
  mask: GrayMask,
  radius: number,
  bounds: Rect | null = null
): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) =>
    ellipticalFilter(m, radius, Math.max, 0)
  )
}

export function shrinkMask(
  mask: GrayMask,
  radius: number,
  bounds: Rect | null = null
): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) =>
    ellipticalFilter(m, radius, Math.min, 0)
  )
}

export function borderMask(
  mask: GrayMask,
  radius: number,
  bounds: Rect | null = null
): GrayMask {
  return withBounds(mask, bounds, Math.round(radius) + 1, (m) => {
    const grown = ellipticalFilter(m, radius, Math.max, 0)
    const shrunk = ellipticalFilter(m, radius, Math.min, 0)
    const out = emptyMask(m.width, m.height)
    for (let p = 0; p < out.data.length; p++) {
      out.data[p] = Math.max(grown.data[p] - shrunk.data[p], 0)
    }
    return out
  })
}

function boxBlurPass(
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
      const outIdx = Math.max(0, Math.min(w - 1, x - r))
      const inIdx = Math.max(0, Math.min(w - 1, x + r + 1))
      acc += src[row + inIdx] - src[row + outIdx]
    }
  }
}

function transposeMask(mask: GrayMask): GrayMask {
  const out = {
    data: new Float32Array(mask.data.length),
    width: mask.height,
    height: mask.width
  }
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      out.data[x * mask.height + y] = mask.data[y * mask.width + x]
    }
  }
  return out
}

function boxesForGauss(sigma: number, n: number): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal =
    (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  const sizes: number[] = []
  for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu)
  return sizes
}

export function featherMask(
  mask: GrayMask,
  radius: number,
  bounds: Rect | null = null
): GrayMask {
  return withBounds(mask, bounds, Math.ceil(radius) + 2, (m) =>
    featherMaskFull(m, radius)
  )
}

function smallGaussian(mask: GrayMask, sigma: number): GrayMask {
  const r = 2
  const kernel = new Float32Array(2 * r + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) {
    kernel[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma))
    sum += kernel[i + r]
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum
  const pass = (m: GrayMask): GrayMask => {
    const out = emptyMask(m.width, m.height)
    for (let y = 0; y < m.height; y++) {
      const row = y * m.width
      for (let x = 0; x < m.width; x++) {
        let acc = 0
        for (let i = -r; i <= r; i++) {
          const xx = Math.max(0, Math.min(m.width - 1, x + i))
          acc += m.data[row + xx] * kernel[i + r]
        }
        out.data[row + x] = acc
      }
    }
    return out
  }
  return transposeMask(pass(transposeMask(pass(mask))))
}

function featherMaskFull(mask: GrayMask, radius: number): GrayMask {
  const sigma = radius / 3.5
  if (sigma <= 0) return mask
  const boxes = boxesForGauss(sigma, 3)
  if (boxes.every((size) => Math.round((size - 1) / 2) < 1))
    return smallGaussian(mask, sigma)
  const sizes = boxes
  let cur: GrayMask = {
    data: Float32Array.from(mask.data),
    width: mask.width,
    height: mask.height
  }
  const blurAxis = (m: GrayMask): GrayMask => {
    const tmp = new Float32Array(m.data.length)
    let src = m.data
    for (const size of sizes) {
      const r = Math.max(0, (size - 1) / 2)
      if (r < 1) continue
      boxBlurPass(src, tmp, m.width, m.height, Math.round(r))
      src = Float32Array.from(tmp)
    }
    return { data: src, width: m.width, height: m.height }
  }
  cur = blurAxis(cur)
  cur = transposeMask(blurAxis(transposeMask(cur)))
  return cur
}

export interface FloodSource {
  data: Uint8ClampedArray
  width: number
  height: number
}

function pixelDifference(
  c1r: number,
  c1g: number,
  c1b: number,
  c1a: number,
  data: Uint8ClampedArray,
  idx: number,
  antialias: boolean,
  threshold: number
): number {
  const a2 = data[idx + 3] / 255
  if (c1a > 0 && a2 === 0) return 0
  let max: number
  if (c1a === 0) {
    max = Math.abs(c1a - a2)
  } else {
    max = Math.abs(c1r - data[idx] / 255)
    const dg = Math.abs(c1g - data[idx + 1] / 255)
    const db = Math.abs(c1b - data[idx + 2] / 255)
    if (dg > max) max = dg
    if (db > max) max = db
  }
  if (antialias && threshold > 0) {
    const aa = 1.5 - max / threshold
    if (aa <= 0) return 0
    if (aa < 0.5) return aa * 2
    return 1
  }
  return max > threshold ? 0 : 1
}

export function floodSelectMask(
  src: FloodSource,
  seed: Vec2,
  threshold: number,
  antialias: boolean,
  contiguous: boolean,
  diagonalNeighbors = false
): GrayMask | null {
  const w = src.width
  const h = src.height
  const sx = Math.floor(seed.x)
  const sy = Math.floor(seed.y)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null
  const si = (sy * w + sx) * 4
  const c1r = src.data[si] / 255
  const c1g = src.data[si + 1] / 255
  const c1b = src.data[si + 2] / 255
  const c1a = src.data[si + 3] / 255
  const mask = emptyMask(w, h)

  if (!contiguous) {
    for (let p = 0; p < w * h; p++) {
      mask.data[p] = pixelDifference(
        c1r,
        c1g,
        c1b,
        c1a,
        src.data,
        p * 4,
        antialias,
        threshold
      )
    }
    return mask
  }

  const diff = (x: number, y: number): number =>
    pixelDifference(
      c1r,
      c1g,
      c1b,
      c1a,
      src.data,
      (y * w + x) * 4,
      antialias,
      threshold
    )

  const queue: number[] = []
  const push = (
    y: number,
    oldY: number,
    start: number,
    end: number,
    newY: number,
    newStart: number,
    newEnd: number
  ): void => {
    if (newY !== oldY) {
      queue.push(newY, y, newStart, newEnd)
    } else {
      if (newStart < start) queue.push(newY, y, newStart, start + 1)
      if (newEnd > end) queue.push(newY, y, end - 1, newEnd)
    }
  }

  const findSegment = (x: number, y: number): [number, number] | null => {
    const d0 = diff(x, y)
    if (d0 === 0) return null
    const row = y * w
    mask.data[row + x] = d0
    let start = x - 1
    while (start >= 0) {
      const d = diff(start, y)
      if (d === 0) break
      mask.data[row + start] = d
      start--
    }
    let end = x + 1
    while (end < w) {
      const d = diff(end, y)
      if (d === 0) break
      mask.data[row + end] = d
      end++
    }
    return [start, end]
  }

  push(sy, -1, 0, 0, sy, sx - 1, sx + 1)
  while (queue.length) {
    const end = queue.pop()!
    const start = queue.pop()!
    const oldY = queue.pop()!
    const y = queue.pop()!
    for (let x = start + 1; x < end; x++) {
      if (mask.data[y * w + x] !== 0) {
        x++
        continue
      }
      const seg = findSegment(x, y)
      if (!seg) continue
      let [newStart, newEnd] = seg
      x = newEnd
      if (diagonalNeighbors) {
        if (newStart >= 0) newStart--
        if (newEnd < w) newEnd++
      }
      if (y + 1 < h) push(y, oldY, start, end, y + 1, newStart, newEnd)
      if (y - 1 >= 0) push(y, oldY, start, end, y - 1, newStart, newEnd)
    }
  }
  return mask
}

export function maskBoundary(mask: GrayMask, threshold = 0.5): Vec2[][] {
  const w = mask.width
  const h = mask.height
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && mask.data[y * w + x] >= threshold
  const edges = new Map<number, Array<{ ex: number; ey: number }>>()
  const key = (x: number, y: number): number => y * (w + 1) + x
  const addEdge = (sx: number, sy: number, ex: number, ey: number): void => {
    const k = key(sx, sy)
    const list = edges.get(k)
    if (list) list.push({ ex, ey })
    else edges.set(k, [{ ex, ey }])
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      if (!inside(x, y - 1)) addEdge(x, y, x + 1, y)
      if (!inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1)
      if (!inside(x - 1, y)) addEdge(x, y + 1, x, y)
      if (!inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1)
    }
  }
  const loops: Vec2[][] = []
  while (edges.size) {
    const firstKey = edges.keys().next().value as number
    const first = edges.get(firstKey)!
    const start = { x: firstKey % (w + 1), y: Math.floor(firstKey / (w + 1)) }
    let cur = first.shift()!
    if (!first.length) edges.delete(firstKey)
    const pts: Vec2[] = [start, { x: cur.ex, y: cur.ey }]
    while (cur.ex !== start.x || cur.ey !== start.y) {
      const k = key(cur.ex, cur.ey)
      const list = edges.get(k)
      if (!list || !list.length) break
      cur = list.shift()!
      if (!list.length) edges.delete(k)
      pts.push({ x: cur.ex, y: cur.ey })
    }
    const last = pts[pts.length - 1]
    if (pts.length > 1 && last.x === pts[0].x && last.y === pts[0].y) pts.pop()
    if (pts.length > 2) {
      const compact: Vec2[] = []
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[(i - 1 + pts.length) % pts.length]
        const next = pts[(i + 1) % pts.length]
        const p = pts[i]
        const collinear =
          (prev.x === p.x && p.x === next.x) ||
          (prev.y === p.y && p.y === next.y)
        if (!collinear) compact.push(p)
      }
      if (compact.length >= 3) loops.push(compact)
    }
  }
  return loops
}

export function rectMask(width: number, height: number, rect: Rect): GrayMask {
  const out = emptyMask(width, height)
  const x0 = Math.max(0, Math.round(rect.x))
  const y0 = Math.max(0, Math.round(rect.y))
  const x1 = Math.min(width, Math.round(rect.x + rect.w))
  const y1 = Math.min(height, Math.round(rect.y + rect.h))
  for (let y = y0; y < y1; y++) out.data.fill(1, y * width + x0, y * width + x1)
  return out
}

export function ellipseMask(
  width: number,
  height: number,
  rect: Rect
): GrayMask {
  const out = emptyMask(width, height)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const rx = rect.w / 2
  const ry = rect.h / 2
  if (rx <= 0 || ry <= 0) return out
  const y0 = Math.max(0, Math.floor(rect.y))
  const y1 = Math.min(height, Math.ceil(rect.y + rect.h))
  const x0 = Math.max(0, Math.floor(rect.x))
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      const d = Math.sqrt(dx * dx + dy * dy)
      const edge = (1 - d) * Math.min(rx, ry)
      out.data[y * width + x] = Math.max(0, Math.min(1, edge + 0.5))
    }
  }
  return out
}

export function polygonMask(
  width: number,
  height: number,
  points: Vec2[]
): GrayMask {
  const out = emptyMask(width, height)
  if (points.length < 3) return out
  const SS = 2
  for (let y = 0; y < height; y++) {
    for (let s = 0; s < SS; s++) {
      const py = y + (s + 0.5) / SS
      const xs: number[] = []
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i]
        const b = points[j]
        if (a.y <= py === b.y <= py) continue
        xs.push(a.x + ((py - a.y) / (b.y - a.y)) * (b.x - a.x))
      }
      xs.sort((m, n) => m - n)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = xs[k]
        const x1 = xs[k + 1]
        const ix0 = Math.max(0, Math.floor(x0))
        const ix1 = Math.min(width - 1, Math.ceil(x1))
        for (let x = ix0; x <= ix1; x++) {
          const cov = Math.max(0, Math.min(x + 1, x1) - Math.max(x, x0))
          out.data[y * width + x] = Math.min(
            1,
            out.data[y * width + x] + cov / SS
          )
        }
      }
    }
  }
  return out
}

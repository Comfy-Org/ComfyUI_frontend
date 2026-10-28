export interface GradientStop {
  offset: number
  color: string
  alpha?: number
}

export type FillSpec =
  | { type: 'solid'; color: string }
  | { type: 'linear'; angle: number; stops: GradientStop[] }
  | {
      type: 'radial'
      cx: number
      cy: number
      radius: number
      stops: GradientStop[]
    }

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && isFinite(v) ? v : d

export function defaultFillSpec(): FillSpec {
  return { type: 'solid', color: '#808080' }
}

export function defaultGradientStops(): GradientStop[] {
  return [
    { offset: 0, color: '#000000' },
    { offset: 1, color: '#ffffff' }
  ]
}

function normalizeStops(raw: unknown): GradientStop[] {
  const arr = Array.isArray(raw) ? raw : []
  const stops: GradientStop[] = []
  for (const s of arr) {
    const r = (s ?? {}) as Record<string, unknown>
    if (typeof r.color !== 'string') continue
    stops.push({
      offset: clamp01(num(r.offset, 0)),
      color: r.color,
      alpha: r.alpha === undefined ? undefined : clamp01(num(r.alpha, 1))
    })
  }
  stops.sort((a, b) => a.offset - b.offset)
  return stops.length >= 2 ? stops : defaultGradientStops()
}

export function normalizeFillSpec(raw: unknown): FillSpec {
  const r = (raw ?? {}) as Record<string, unknown>
  if (r.type === 'linear') {
    return {
      type: 'linear',
      angle: num(r.angle, 0) % 360,
      stops: normalizeStops(r.stops)
    }
  }
  if (r.type === 'radial') {
    return {
      type: 'radial',
      cx: clamp01(num(r.cx, 0.5)),
      cy: clamp01(num(r.cy, 0.5)),
      radius: Math.max(0.01, Math.min(4, num(r.radius, 1))),
      stops: normalizeStops(r.stops)
    }
  }
  return {
    type: 'solid',
    color: typeof r.color === 'string' ? r.color : '#808080'
  }
}

export function cloneFillSpec(spec: FillSpec): FillSpec {
  if (spec.type === 'solid') return { ...spec }
  if (spec.type === 'linear')
    return { ...spec, stops: spec.stops.map((s) => ({ ...s })) }
  return { ...spec, stops: spec.stops.map((s) => ({ ...s })) }
}

export function fillSpecStamp(spec: FillSpec): string {
  return JSON.stringify(spec)
}

export function linearEndpoints(
  angle: number,
  w: number,
  h: number
): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const a = (angle * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  const cx = w / 2
  const cy = h / 2
  return {
    from: { x: cx - dx * half, y: cy - dy * half },
    to: { x: cx + dx * half, y: cy + dy * half }
  }
}

function stopColor(stop: GradientStop): string {
  if (stop.alpha === undefined || stop.alpha >= 1) return stop.color
  const hex = stop.color.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${stop.alpha})`
}

export function paintFillInto(
  g: CanvasRenderingContext2D,
  spec: FillSpec,
  w: number,
  h: number
): void {
  if (spec.type === 'solid') {
    g.fillStyle = spec.color
    g.fillRect(0, 0, w, h)
    return
  }
  let gradient: CanvasGradient
  if (spec.type === 'linear') {
    const { from, to } = linearEndpoints(spec.angle, w, h)
    gradient = g.createLinearGradient(from.x, from.y, to.x, to.y)
  } else {
    const cx = spec.cx * w
    const cy = spec.cy * h
    const r = Math.max(1e-3, spec.radius * (Math.hypot(w, h) / 2))
    gradient = g.createRadialGradient(cx, cy, 0, cx, cy, r)
  }
  for (const stop of spec.stops)
    gradient.addColorStop(stop.offset, stopColor(stop))
  g.fillStyle = gradient
  g.fillRect(0, 0, w, h)
}

export function renderFillBitmap(
  spec: FillSpec,
  w: number,
  h: number
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  const g = canvas.getContext('2d')
  if (!g) return null
  paintFillInto(g, spec, canvas.width, canvas.height)
  return canvas
}

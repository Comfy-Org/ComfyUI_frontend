/**
 * The CrossView Warp camera, ported line for line from the node pack
 * (comfyrob/ComfyUI-CrossViewWarp, crossview_warp_node.py) so the browser
 * preview aims the camera exactly where the generation will.
 *
 * Frame: OpenCV-style, x right, y down, z forward. The source camera sits at
 * the origin looking down +z; a pose is a 4x4 camera-to-world matrix whose
 * columns are (right, down, forward, eye), stored column-major.
 */

export type Vec3 = readonly [number, number, number]
/** Column-major 4x4, the layout WebGL uniforms expect. */
export type Mat4 = Float32Array

const DEG = Math.PI / 180

export interface Pose {
  readonly az: number
  readonly el: number
  readonly dist: number
  readonly vs: number
  readonly px: number
  readonly py: number
  readonly pz: number
}

export interface Keyframe extends Pose {
  /** 1-based frame number, as the node counts. */
  readonly f: number
}

export type Motion =
  | 'linear'
  | 'ease_in'
  | 'ease_out'
  | 'ease_in_out'
  | 'smooth'

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]

/** _look_at: a pose at `eye` facing `target`, world "down" = +y. */
function lookAt(eye: Vec3, target: Vec3): Mat4 {
  let f = sub(target, eye)
  f = scale(f, 1 / (norm(f) + 1e-9))
  let right = cross([0, 1, 0], f)
  let rn = norm(right)
  if (rn < 1e-6) {
    right = cross([0, 0, 1], f)
    rn = norm(right)
  }
  right = scale(right, 1 / (rn + 1e-9))
  const down = cross(f, right)
  // prettier-ignore
  return new Float32Array([
    right[0], right[1], right[2], 0,
    down[0], down[1], down[2], 0,
    f[0], f[1], f[2], 0,
    eye[0], eye[1], eye[2], 1
  ])
}

/**
 * _orbit_C_tgt: orbit `pivot` by az/el (degrees; +az right, +el up) at
 * `dist` times the pivot's own distance, looking at `aim` (default the pivot).
 */
export function orbitPose(
  az: number,
  el: number,
  dist: number,
  pivot: Vec3,
  aim?: Vec3
): Mat4 {
  const a = -az * DEG
  const e = -el * DEG
  const [ca, sa, ce, se] = [Math.cos(a), Math.sin(a), Math.cos(e), Math.sin(e)]
  // R = rotY(a) @ rotX(e), applied to -pivot
  const [x, y, z] = [-pivot[0], -pivot[1], -pivot[2]]
  const rx: Vec3 = [x, ce * y - se * z, se * y + ce * z]
  const r: Vec3 = [ca * rx[0] + sa * rx[2], rx[1], -sa * rx[0] + ca * rx[2]]
  const eye: Vec3 = [
    pivot[0] + dist * r[0],
    pivot[1] + dist * r[1],
    pivot[2] + dist * r[2]
  ]
  return lookAt(eye, aim ?? pivot)
}

/** keep_source_aim: stay pointed down the source camera's axis, at the pivot's range. */
export function sourceAim(pivot: Vec3): Vec3 {
  return [0, 0, Math.max(norm(pivot), 1e-3)]
}

/** Focal length in pixels for a horizontal field of view across `width`. */
export function focalPx(width: number, hfovDeg: number): number {
  return width / (2 * Math.tan((hfovDeg * DEG) / 2))
}

/** numpy.percentile with its default linear interpolation, on a sorted array. */
function percentileSorted(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return 0
  const idx = ((sorted.length - 1) * q) / 100
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function median(values: number[]): number {
  values.sort((a, b) => a - b)
  return percentileSorted(values, 50)
}

/**
 * build()'s automatic pivot: the median 3D point of the central region of
 * frame 0, with its farthest 5% trimmed. Scene-level aim, not the nearest blob.
 */
export function estimatePivot(
  depth: Float32Array,
  width: number,
  height: number,
  fx: number
): Vec3 {
  const [r0, r1] = [Math.floor(height / 8), Math.floor((4 * height) / 5)]
  const [c0, c1] = [Math.floor(width / 5), Math.floor((4 * width) / 5)]
  const zs: number[] = []
  for (let v = r0; v < r1; v++)
    for (let u = c0; u < c1; u++) {
      const z = depth[v * width + u]
      if (Number.isFinite(z) && z > 0) zs.push(z)
    }
  if (zs.length === 0) return [0, 0, 1.05]
  const cut = percentileSorted(Float64Array.from(zs).sort(), 95)
  const xs: number[] = []
  const ys: number[] = []
  const zz: number[] = []
  const [cx, cy] = [width / 2, height / 2]
  for (let v = r0; v < r1; v++)
    for (let u = c0; u < c1; u++) {
      const z = depth[v * width + u]
      if (!(Number.isFinite(z) && z > 0 && z < cut)) continue
      xs.push(((u - cx) / fx) * z)
      ys.push(((v - cy) / fx) * z)
      zz.push(z)
    }
  return [median(xs), median(ys), median(zz)]
}

// --- keyframed moves (_ease, _unwrap_seq, _catmull, _seg_value, _sample_path)

const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180

function ease(t: number, mode: Motion): number {
  if (mode === 'ease_in_out') return 0.5 - 0.5 * Math.cos(Math.PI * t)
  if (mode === 'ease_in') return t * t
  if (mode === 'ease_out') return 1 - (1 - t) * (1 - t)
  return t
}

function unwrap(degs: number[]): number[] {
  const out = [degs[0]]
  for (const d of degs.slice(1)) {
    const last = out[out.length - 1]
    out.push(last + wrapDeg(d - last))
  }
  return out
}

function segValue(vals: number[], seg: number, u: number, smooth: boolean) {
  const [p1, p2] = [vals[seg], vals[seg + 1]]
  if (!smooth || vals.length < 3) return p1 + (p2 - p1) * u
  const p0 = seg > 0 ? vals[seg - 1] : p1 + (p1 - p2)
  const p3 = seg + 2 < vals.length ? vals[seg + 2] : p2 + (p2 - p1)
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
  )
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/** The pose a keyframed move holds at a 1-based frame. */
export function samplePath(
  keyframes: readonly Keyframe[],
  frame: number,
  motion: Motion
): Pose {
  const kfs = [...keyframes].sort((a, b) => a.f - b.f)
  const ch = (key: keyof Pose) => kfs.map((k) => k[key])
  const az = unwrap(ch('az'))
  // Held, not extrapolated, before the first key and after the last; the
  // node holds the unwrapped azimuth there, which is the same direction.
  const hold = (i: number): Pose => ({ ...kfs[i], az: az[i] })
  if (frame <= kfs[0].f) return hold(0)
  if (frame >= kfs[kfs.length - 1].f) return hold(kfs.length - 1)
  // `motion` carries both the easing and the spline, as the node's widget does
  const smooth = motion === 'smooth'
  const easing: Motion = smooth ? 'linear' : motion
  let seg = 0
  for (let i = 0; i < kfs.length - 1; i++)
    if (kfs[i].f <= frame && frame <= kfs[i + 1].f) {
      seg = i
      break
    }
  const u = ease((frame - kfs[seg].f) / (kfs[seg + 1].f - kfs[seg].f), easing)
  return {
    az: wrapDeg(segValue(az, seg, u, smooth)),
    el: clamp(segValue(ch('el'), seg, u, smooth), -90, 90),
    dist: clamp(segValue(ch('dist'), seg, u, smooth), 0.1, 3),
    vs: clamp(segValue(ch('vs'), seg, u, smooth), -1, 1),
    px: segValue(ch('px'), seg, u, smooth),
    py: segValue(ch('py'), seg, u, smooth),
    pz: Math.max(segValue(ch('pz'), seg, u, smooth), 0.01)
  }
}

/**
 * Where the LoRA was trained, from the node's orbit picker: half-axes of an
 * ellipse in (azimuth, elevation-up, elevation-down) degrees.
 */
const ZONE_GREEN = [45, 30, 20] as const
const ZONE_YELLOW = [90, 45, 35] as const

export function zoneOf(az: number, el: number): 'green' | 'yellow' | 'red' {
  const inside = ([a, up, down]: readonly number[]) => {
    const an = az / a
    const en = el >= 0 ? el / up : el / down
    return an * an + en * en <= 1
  }
  if (inside(ZONE_GREEN)) return 'green'
  if (inside(ZONE_YELLOW)) return 'yellow'
  return 'red'
}

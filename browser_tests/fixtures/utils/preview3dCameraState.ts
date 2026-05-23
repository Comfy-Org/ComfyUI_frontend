interface Preview3dCameraStatePayload {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  zoom?: number
  cameraType?: string
}

type Vec3 = { x: number; y: number; z: number }

function isVec3(v: unknown): v is Vec3 {
  if (v === null || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    'x' in v &&
    typeof r.x === 'number' &&
    'y' in v &&
    typeof r.y === 'number' &&
    'z' in v &&
    typeof r.z === 'number'
  )
}

function isPreview3dCameraStatePayload(
  v: unknown
): v is Preview3dCameraStatePayload {
  if (v === null || typeof v !== 'object') return false
  if (!('position' in v) || !('target' in v)) return false
  const r = v as Record<string, unknown>
  return isVec3(r.position) && isVec3(r.target)
}

function vecMaxAbsDelta(a: Vec3, b: Vec3): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z))
}

function vecWithinEps(a: Vec3, b: Vec3, eps: number): boolean {
  return vecMaxAbsDelta(a, b) <= eps
}

/**
 * Max abs error per position/target axis when comparing restored Preview3D
 * camera state (same order of magnitude as the former 2e-2 poll tolerance).
 */
export const PREVIEW3D_CAMERA_AXIS_RESTORE_EPS = 0.02

/**
 * Max abs zoom error when comparing restored Preview3D state (aligned with
 * Playwright `toBeCloseTo(..., 5)`-style checks on typical zoom magnitudes).
 */
export const PREVIEW3D_CAMERA_ZOOM_RESTORE_EPS = 1e-4

export function preview3dRestoreCameraStatesMatch(
  a: unknown,
  b: unknown
): boolean {
  if (!isPreview3dCameraStatePayload(a) || !isPreview3dCameraStatePayload(b)) {
    return false
  }
  if (a.cameraType !== b.cameraType) return false
  const zoomA = typeof a.zoom === 'number' ? a.zoom : 0
  const zoomB = typeof b.zoom === 'number' ? b.zoom : 0
  if (Math.abs(zoomA - zoomB) > PREVIEW3D_CAMERA_ZOOM_RESTORE_EPS) {
    return false
  }
  return (
    vecWithinEps(a.position, b.position, PREVIEW3D_CAMERA_AXIS_RESTORE_EPS) &&
    vecWithinEps(a.target, b.target, PREVIEW3D_CAMERA_AXIS_RESTORE_EPS)
  )
}

export function preview3dCameraStatesDiffer(
  a: unknown,
  b: unknown,
  eps: number
): boolean {
  if (!isPreview3dCameraStatePayload(a) || !isPreview3dCameraStatePayload(b)) {
    return true
  }
  if (a.cameraType !== b.cameraType) return true
  const zoomA = typeof a.zoom === 'number' ? a.zoom : 0
  const zoomB = typeof b.zoom === 'number' ? b.zoom : 0
  if (Math.abs(zoomA - zoomB) > eps) return true
  return !(
    vecWithinEps(a.position, b.position, eps) &&
    vecWithinEps(a.target, b.target, eps)
  )
}

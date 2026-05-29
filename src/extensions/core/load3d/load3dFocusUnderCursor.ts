import * as THREE from 'three'

type RenderRegion = {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

type FocusUnderCursorDeps = {
  canvas: HTMLCanvasElement
  getModel: () => THREE.Object3D | null
  getCamera: () => THREE.Camera
  getRenderRegion: () => RenderRegion
  focusOn: (point: THREE.Vector3, distance?: number) => void
  isDisabled?: () => boolean
}

// Camera lands `HIT_OBJECT_FOCUS_FACTOR × hit-object-bounding-radius` away
// (FOV-corrected). Idempotent: distance is derived from the hit object's own
// size, so repeated F presses settle to the same distance instead of
// compounding closer.
const HIT_OBJECT_FOCUS_FACTOR = 0.35

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el instanceof HTMLElement && el.isContentEditable
}

function computeFocusDistance(
  hit: THREE.Intersection,
  camera: THREE.Camera
): number | undefined {
  if (!(hit.object instanceof THREE.Mesh)) return undefined
  const geo = hit.object.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  if (!geo.boundingSphere) return undefined

  const radius = geo.boundingSphere
    .clone()
    .applyMatrix4(hit.object.matrixWorld).radius
  if (radius <= 0) return undefined

  const fovScale =
    camera instanceof THREE.PerspectiveCamera
      ? 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      : 1
  return radius * HIT_OBJECT_FOCUS_FACTOR * fovScale
}

export function getNDCFromPointer(
  canvas: HTMLCanvasElement,
  region: RenderRegion,
  pointer: { x: number; y: number }
): THREE.Vector2 | null {
  if (region.width <= 0 || region.height <= 0) return null
  const rect = canvas.getBoundingClientRect()
  // rect dimensions reflect any ancestor CSS transforms (e.g. graph zoom),
  // while clientWidth/Height stay in logical CSS px. Convert the pointer back
  // to logical CSS so it lines up with the render region.
  const scaleX = rect.width === 0 ? 1 : canvas.clientWidth / rect.width
  const scaleY = rect.height === 0 ? 1 : canvas.clientHeight / rect.height
  const localX = (pointer.x - rect.left) * scaleX - region.offsetX
  const localY = (pointer.y - rect.top) * scaleY - region.offsetY
  if (
    localX < 0 ||
    localY < 0 ||
    localX > region.width ||
    localY > region.height
  ) {
    return null
  }
  return new THREE.Vector2(
    (localX / region.width) * 2 - 1,
    -(localY / region.height) * 2 + 1
  )
}

export function attachFocusUnderCursor(deps: FocusUnderCursorDeps): () => void {
  const controller = new AbortController()
  const { signal } = controller

  let pointerOnCanvas: { x: number; y: number } | null = null
  const raycaster = new THREE.Raycaster()
  // Only matters if the model contains a THREE.Points (e.g. PLY point cloud).
  // For ordinary meshes this has no effect.
  raycaster.params.Points.threshold = 0.1

  deps.canvas.addEventListener(
    'pointermove',
    (e) => {
      pointerOnCanvas = { x: e.clientX, y: e.clientY }
    },
    { signal }
  )

  deps.canvas.addEventListener(
    'pointerleave',
    () => {
      pointerOnCanvas = null
    },
    { signal }
  )

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (deps.isDisabled?.()) return
      if (!pointerOnCanvas) return
      if (isEditableElement(document.activeElement)) return

      const model = deps.getModel()
      if (!model) return

      const ndc = getNDCFromPointer(
        deps.canvas,
        deps.getRenderRegion(),
        pointerOnCanvas
      )
      if (!ndc) return

      raycaster.setFromCamera(ndc, deps.getCamera())
      const intersects = raycaster.intersectObject(model, true)
      if (intersects.length === 0) return

      e.preventDefault()
      const hit = intersects[0]
      deps.focusOn(hit.point, computeFocusDistance(hit, deps.getCamera()))
    },
    { signal }
  )

  return () => controller.abort()
}

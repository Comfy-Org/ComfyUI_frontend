import * as THREE from 'three'

const PICK_PIXEL_RADIUS = 14

interface CanvasSize {
  clientWidth: number
  clientHeight: number
}

function toScreenPx(
  ndcX: number,
  ndcY: number,
  canvas: CanvasSize
): THREE.Vector2 {
  return new THREE.Vector2(
    (ndcX + 1) * 0.5 * canvas.clientWidth,
    (1 - (ndcY + 1) * 0.5) * canvas.clientHeight
  )
}

export function pickHandleAtPointer<T extends string>(
  raycaster: THREE.Raycaster,
  pointerNdc: THREE.Vector2,
  camera: THREE.Camera,
  targets: THREE.Object3D[],
  canvas: CanvasSize
): T | null {
  if (targets.length === 0) return null

  raycaster.setFromCamera(pointerNdc, camera)
  const hits = raycaster.intersectObjects(targets, false)
  if (hits.length > 0) return hits[0].object.userData.handleType as T

  const pointerPx = toScreenPx(pointerNdc.x, pointerNdc.y, canvas)
  const world = new THREE.Vector3()
  let best: T | null = null
  let bestDistance = PICK_PIXEL_RADIUS
  for (const target of targets) {
    target.getWorldPosition(world)
    const view = world.clone().applyMatrix4(camera.matrixWorldInverse)
    if (view.z >= 0) continue // behind the camera
    const ndc = world.project(camera)
    const px = toScreenPx(ndc.x, ndc.y, canvas)
    const distance = px.distanceTo(pointerPx)
    if (distance < bestDistance) {
      bestDistance = distance
      best = target.userData.handleType as T
    }
  }
  return best
}

import * as THREE from 'three'

import { QuadWireframeOverlay } from './QuadWireframeManager'

type MaterialMap = WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })
  return meshes
}

export function adoptClonedModel(
  clone: THREE.Object3D,
  source: THREE.Object3D,
  sourceOriginals: MaterialMap,
  cloneOriginals?: MaterialMap
): void {
  const overlays: THREE.Object3D[] = []
  clone.traverse((child) => {
    if (child instanceof QuadWireframeOverlay) overlays.push(child)
  })
  for (const overlay of overlays) overlay.removeFromParent()

  const sourceMeshes = meshesOf(source)
  meshesOf(clone).forEach((mesh, i) => {
    const original = sourceOriginals.get(sourceMeshes[i]) ?? mesh.material
    mesh.material = original
    cloneOriginals?.set(mesh, original)
  })
}

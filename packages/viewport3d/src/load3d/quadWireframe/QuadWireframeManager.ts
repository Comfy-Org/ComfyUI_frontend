import {
  createPolygonEdgesGeometry,
  polygonMeshFromTriangles
} from '@comfyorg/quad-wireframe-three'
import * as THREE from 'three'

import { faceSizesFor } from './faceSizesRegistry'

export class QuadWireframeOverlay extends THREE.LineSegments {}

export const MAX_TRIANGLE_OUTLINE = 300_000

function isDeforming(mesh: THREE.Mesh): boolean {
  const hasMorphs = Object.keys(mesh.geometry.morphAttributes).length > 0
  return mesh instanceof THREE.SkinnedMesh || hasMorphs
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const corners =
    geometry.index?.count ?? geometry.getAttribute('position').count
  return Math.floor(corners / 3)
}

export class QuadWireframeManager {
  private readonly overlays = new Map<THREE.Mesh, QuadWireframeOverlay>()
  private readonly cache = new Map<THREE.BufferGeometry, THREE.BufferGeometry>()
  private readonly material = new THREE.LineBasicMaterial({ color: 0xffffff })

  show(model: THREE.Object3D): THREE.Mesh[] {
    this.hide()
    const quads: THREE.Mesh[] = []
    const triangles: THREE.Mesh[] = []
    let triangleTotal = 0
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || isDeforming(child)) return
      if (faceSizesFor(child.geometry)) {
        quads.push(child)
      } else {
        triangles.push(child)
        triangleTotal += triangleCount(child.geometry)
      }
    })
    const outlined =
      triangleTotal > MAX_TRIANGLE_OUTLINE ? quads : [...quads, ...triangles]
    for (const child of outlined) {
      const overlay = new QuadWireframeOverlay(
        this.edgesFor(child.geometry),
        this.material
      )
      overlay.renderOrder = 1
      child.add(overlay)
      this.overlays.set(child, overlay)
    }
    return outlined
  }

  hide(): void {
    for (const [mesh, overlay] of this.overlays) mesh.remove(overlay)
    this.overlays.clear()
  }

  clear(): void {
    this.hide()
    for (const edges of this.cache.values()) edges.dispose()
    this.cache.clear()
  }

  dispose(): void {
    this.clear()
    this.material.dispose()
  }

  private edgesFor(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let edges = this.cache.get(geometry)
    if (!edges) {
      edges = createPolygonEdgesGeometry(
        polygonMeshFromTriangles(geometry, faceSizesFor(geometry))
      )
      this.cache.set(geometry, edges)
    }
    return edges
  }
}

import type * as THREE from 'three'

const faceSizesByGeometry = new WeakMap<THREE.BufferGeometry, Uint32Array>()

export function registerFaceSizes(
  geometry: THREE.BufferGeometry,
  faceSizes: Uint32Array
): void {
  faceSizesByGeometry.set(geometry, faceSizes)
}

export function faceSizesFor(
  geometry: THREE.BufferGeometry
): Uint32Array | undefined {
  return faceSizesByGeometry.get(geometry)
}

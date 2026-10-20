import * as THREE from 'three'

const RAD2DEG = 180 / Math.PI

export interface RollBasis {
  up: THREE.Vector3
  right: THREE.Vector3
  backward: THREE.Vector3
}

export function rollBasis(
  target: THREE.Vector3Like,
  cameraPos: THREE.Vector3Like
): RollBasis {
  const backward = new THREE.Vector3(
    cameraPos.x - target.x,
    cameraPos.y - target.y,
    cameraPos.z - target.z
  )
  if (backward.lengthSq() < 1e-8) backward.set(0, 0, 1)
  else backward.normalize()
  const worldUp = new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(worldUp, backward)
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  else right.normalize()
  const up = new THREE.Vector3().crossVectors(backward, right).normalize()
  return { up, right, backward }
}

export function pointToRollAngle(
  point: THREE.Vector3Like,
  target: THREE.Vector3Like,
  cameraPos: THREE.Vector3Like
): number {
  const { up, right } = rollBasis(target, cameraPos)
  const rel = new THREE.Vector3(
    point.x - target.x,
    point.y - target.y,
    point.z - target.z
  )
  return Math.atan2(rel.dot(right), rel.dot(up)) * RAD2DEG
}

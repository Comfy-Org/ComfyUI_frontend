import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { pickHandleAtPointer } from './handlePicking'

const CANVAS = { clientWidth: 400, clientHeight: 400 }

function makeHandle(handleType: string, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8))
  mesh.userData.handleType = handleType
  mesh.position.copy(position)
  mesh.updateMatrixWorld(true)
  return mesh
}

describe('pickHandleAtPointer', () => {
  let camera: THREE.PerspectiveCamera
  let raycaster: THREE.Raycaster

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    raycaster = new THREE.Raycaster()
  })

  it('returns the handle type on a direct raycast hit', () => {
    const handle = makeHandle('yaw', new THREE.Vector3(0, 0, 0))
    const picked = pickHandleAtPointer(
      raycaster,
      new THREE.Vector2(0, 0),
      camera,
      [handle],
      CANVAS
    )
    expect(picked).toBe('yaw')
  })

  it('picks a handle within the screen-space tolerance on a near miss', () => {
    const handle = makeHandle('pitch', new THREE.Vector3(0, 0, 0))
    // ~10px off centre: outside the 0.08-radius sphere but inside tolerance.
    const nearMissNdc = new THREE.Vector2(10 / (CANVAS.clientWidth / 2), 0)
    const picked = pickHandleAtPointer(
      raycaster,
      nearMissNdc,
      camera,
      [handle],
      CANVAS
    )
    expect(picked).toBe('pitch')
  })

  it('returns null when the pointer is far from every handle', () => {
    const handle = makeHandle('distance', new THREE.Vector3(0, 0, 0))
    const picked = pickHandleAtPointer(
      raycaster,
      new THREE.Vector2(0.5, 0.5),
      camera,
      [handle],
      CANVAS
    )
    expect(picked).toBeNull()
  })

  it('prefers the nearest handle when several are within tolerance', () => {
    // The pointer misses both spheres (no direct raycast hit) but sits inside
    // the screen-space tolerance of each centre; the nearer centre wins.
    const near = makeHandle('yaw', new THREE.Vector3(0.05, 0, 5))
    const far = makeHandle('pitch', new THREE.Vector3(-0.05, 0, 5))
    const picked = pickHandleAtPointer(
      raycaster,
      new THREE.Vector2(0.01, -0.04),
      camera,
      [far, near],
      CANVAS
    )
    expect(picked).toBe('yaw')
  })

  it('ignores handles behind the camera', () => {
    const behind = makeHandle('yaw', new THREE.Vector3(0, 0, 20))
    const picked = pickHandleAtPointer(
      raycaster,
      new THREE.Vector2(0, 0),
      camera,
      [behind],
      CANVAS
    )
    expect(picked).toBeNull()
  })

  it('returns null with no targets', () => {
    const picked = pickHandleAtPointer(
      raycaster,
      new THREE.Vector2(0, 0),
      camera,
      [],
      CANVAS
    )
    expect(picked).toBeNull()
  })
})

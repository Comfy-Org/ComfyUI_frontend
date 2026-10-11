import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { zoomToDisplayDistance } from './cameraAngleMath'
import { CameraMarker, OrbitSphere } from './orbitGizmos'
import { ORBIT_SPHERE_RADIUS, SUBJECT_CENTER } from './types'

describe('OrbitSphere', () => {
  it('is centred on the subject with the orbit radius and can be hidden', () => {
    const scene = new THREE.Scene()
    const sphere = new OrbitSphere()
    sphere.attach(scene)

    const mesh = scene.getObjectByName('CameraAngleOrbitSphere') as THREE.Mesh
    expect(mesh.position.y).toBe(SUBJECT_CENTER.y)
    mesh.geometry.computeBoundingSphere()
    expect(mesh.geometry.boundingSphere!.radius).toBeCloseTo(
      ORBIT_SPHERE_RADIUS
    )

    sphere.setVisible(false)
    expect(sphere.isVisible()).toBe(false)

    sphere.dispose()
    expect(scene.children).toHaveLength(0)
  })
})

describe('CameraMarker', () => {
  it('sits on the compressed orbit and looks at the subject centre', () => {
    const scene = new THREE.Scene()
    const marker = new CameraMarker()
    marker.attach(scene)
    marker.update({ horizontal: 90, vertical: 0, zoom: 10 })

    const group = scene.getObjectByName('CameraAngleCameraMarker')!
    const distance = zoomToDisplayDistance(10)
    expect(group.position.x).toBeCloseTo(SUBJECT_CENTER.x + distance)
    expect(group.position.y).toBeCloseTo(SUBJECT_CENTER.y)
    expect(group.position.z).toBeCloseTo(SUBJECT_CENTER.z)

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      group.quaternion
    )
    expect(forward.x).toBeCloseTo(-1)
  })

  it('toggles visibility and detaches on dispose', () => {
    const scene = new THREE.Scene()
    const marker = new CameraMarker()
    marker.attach(scene)

    marker.setVisible(false)
    expect(marker.isVisible()).toBe(false)

    marker.dispose()
    expect(scene.children).toHaveLength(0)
  })
})

import * as THREE from 'three'
import { assert, describe, expect, it } from 'vitest'

import { OrbitHandles } from '@/extensions/core/cameraInfo/handles/OrbitHandles'
import type { OrbitHandleType } from '@/extensions/core/cameraInfo/handles/OrbitHandles'

import {
  orbitAnglesFor,
  orbitHandleState,
  orbitPosition
} from './lightTransform'
import { createDefaultLight } from './types'
import type { LightInfoEntry } from './types'

describe('orbitPosition', () => {
  it('places zero yaw / zero pitch on +Z at the given distance', () => {
    const pos = orbitPosition({ x: 0, y: 0, z: 0 }, 0, 0, 5)
    expect(pos.x).toBeCloseTo(0)
    expect(pos.y).toBeCloseTo(0)
    expect(pos.z).toBeCloseTo(5)
  })

  it('is offset by the target', () => {
    const pos = orbitPosition({ x: 1, y: 2, z: 3 }, 0, 90, 4)
    expect(pos.x).toBeCloseTo(1)
    expect(pos.y).toBeCloseTo(6)
    expect(pos.z).toBeCloseTo(3)
  })

  it('rotates around Y with yaw', () => {
    const pos = orbitPosition({ x: 0, y: 0, z: 0 }, 90, 0, 2)
    expect(pos.x).toBeCloseTo(2)
    expect(pos.z).toBeCloseTo(0)
  })
})

describe('orbitAnglesFor', () => {
  it('is the inverse of orbitPosition', () => {
    const target = { x: 1, y: -0.5, z: 2 }
    const pos = orbitPosition(target, 40, 30, 7)
    const angles = orbitAnglesFor(pos, target)
    expect(angles.yaw).toBeCloseTo(40)
    expect(angles.pitch).toBeCloseTo(30)
    expect(angles.distance).toBeCloseTo(7)
  })

  it('clamps degenerate zero-distance input to a tiny distance', () => {
    const angles = orbitAnglesFor({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    expect(angles.distance).toBeGreaterThan(0)
  })
})

describe('orbitHandleState', () => {
  const DIAGONAL = 1.5 * Math.SQRT1_2
  const round = (v: number) => Math.round(v * 1000) / 1000

  const aimedLight: LightInfoEntry = {
    ...createDefaultLight('directional'),
    position: { x: 2.8, y: 1.8, z: -1 },
    target: { x: 1, y: 0, z: -1 }
  }

  function handlesFor(light: LightInfoEntry | null): OrbitHandles {
    const handles = new OrbitHandles()
    handles.attach(new THREE.Scene())
    handles.update(orbitHandleState(light))
    return handles
  }

  function handlePosition(handles: OrbitHandles, type: OrbitHandleType) {
    const mesh = handles
      .pickableMeshes()
      .find((m) => m.userData.handleType === type)
    assert.exists(mesh)
    return mesh.getWorldPosition(new THREE.Vector3()).toArray().map(round)
  }

  it.for([
    { type: 'yaw', expected: [2.5, 0, -1] },
    { type: 'pitch', expected: [round(1 + DIAGONAL), round(DIAGONAL), -1] },
    { type: 'distance', expected: [2.8, 1.8, -1] }
  ] as const)(
    'places the $type handle around the light target',
    ({ type, expected }) => {
      expect(handlePosition(handlesFor(aimedLight), type)).toEqual(expected)
    }
  )

  it.for([
    { label: 'directional light', light: aimedLight, visible: true },
    {
      label: 'point light',
      light: createDefaultLight('point'),
      visible: false
    },
    { label: 'spot light', light: createDefaultLight('spot'), visible: false },
    { label: 'no light', light: null, visible: false }
  ])('shows the orbit handles for a $label: $visible', ({ light, visible }) => {
    expect(handlesFor(light).isVisible()).toBe(visible)
  })

  it('drags yaw on the horizontal plane through the target', () => {
    const plane = new OrbitHandles().dragPlaneFor(
      'yaw',
      orbitHandleState(aimedLight)
    )

    expect(plane.distanceToPoint(new THREE.Vector3(1, 0, -1))).toBeCloseTo(0)
    expect(plane.distanceToPoint(new THREE.Vector3(9, 0, 7))).toBeCloseTo(0)
    expect(
      Math.abs(plane.distanceToPoint(new THREE.Vector3(1, 1, -1)))
    ).toBeCloseTo(1)
  })

  it.for(['pitch', 'distance'] as const)(
    'drags %s on the vertical plane through the target and the light',
    (type) => {
      const plane = new OrbitHandles().dragPlaneFor(
        type,
        orbitHandleState(aimedLight)
      )

      expect(plane.distanceToPoint(new THREE.Vector3(1, 0, -1))).toBeCloseTo(0)
      expect(
        plane.distanceToPoint(new THREE.Vector3(2.8, 1.8, -1))
      ).toBeCloseTo(0)
      expect(plane.distanceToPoint(new THREE.Vector3(1, 5, -1))).toBeCloseTo(0)
    }
  )
})

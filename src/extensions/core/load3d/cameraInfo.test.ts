import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { toCameraState } from '@/extensions/core/load3d/cameraInfo'

describe('toCameraState', () => {
  it('builds Vector3 instances from plain {x,y,z} objects', () => {
    const state = toCameraState({
      position: { x: 1, y: 2, z: 3 },
      target: { x: 4, y: 5, z: 6 },
      zoom: 1.5,
      cameraType: 'perspective'
    })

    expect(state.position).toBeInstanceOf(THREE.Vector3)
    expect(state.target).toBeInstanceOf(THREE.Vector3)
    expect(state.position.toArray()).toEqual([1, 2, 3])
    expect(state.target.toArray()).toEqual([4, 5, 6])
  })

  it('passes zoom and cameraType through unchanged', () => {
    const state = toCameraState({
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 2,
      cameraType: 'orthographic'
    })

    expect(state.zoom).toBe(2)
    expect(state.cameraType).toBe('orthographic')
  })

  it('does not alias the input — mutating the result leaves the input intact', () => {
    const input = {
      position: { x: 1, y: 2, z: 3 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
      cameraType: 'perspective' as const
    }
    const state = toCameraState(input)
    state.position.set(99, 99, 99)

    expect(input.position).toEqual({ x: 1, y: 2, z: 3 })
  })
})

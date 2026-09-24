import { fromAny } from '@total-typescript/shoehorn'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, toRaw, watch } from 'vue'

import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type {
  CameraState,
  CameraType,
  Model3DTransform
} from '@/extensions/core/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeProperty } from '@/types/nodeState'

function makeNode(props: Record<string, NodeProperty | undefined> = {}) {
  return { properties: { ...props } }
}

const baseCameraState: CameraState = {
  position: new THREE.Vector3(1, 2, 3),
  target: new THREE.Vector3(),
  zoom: 1,
  cameraType: 'perspective'
}

function makeLoad3d({
  cameraType = 'perspective',
  fov = 35,
  modelInfo = makeModelInfo()
}: {
  cameraType?: CameraType
  fov?: number
  modelInfo?: Model3DTransform | null
} = {}) {
  return {
    getCurrentCameraType: vi.fn(() => cameraType),
    cameraManager: { perspectiveCamera: { fov } },
    getCameraState: vi.fn(() => baseCameraState),
    stopRecording: vi.fn(),
    getModelInfo: vi.fn(() => modelInfo)
  }
}

function makeModelInfo(position = { x: 0, y: 0, z: 0 }): Model3DTransform {
  return {
    position,
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
  }
}

describe('snapshotLoad3dState', () => {
  it('returns only camera_info and model_3d_info', () => {
    const result = snapshotLoad3dState(makeNode(), makeLoad3d())
    expect(Object.keys(result).sort()).toEqual(['camera_info', 'model_3d_info'])
  })

  it('writes the camera state into properties["Camera Config"]', () => {
    const node = makeNode()
    snapshotLoad3dState(node, makeLoad3d({ fov: 42 }))
    const cfg = node.properties['Camera Config'] as Record<string, unknown>
    expect(cfg).toMatchObject({
      cameraType: 'perspective',
      fov: 42,
      state: baseCameraState
    })
  })

  it('preserves an existing Camera Config object instead of replacing it', () => {
    const existing = { cameraType: 'orthographic', fov: 99 }
    const node = makeNode({ 'Camera Config': existing })
    snapshotLoad3dState(node, makeLoad3d())
    // Same object reference (mutated in place), with state attached.
    expect(node.properties['Camera Config']).toBe(existing)
    expect(
      (node.properties['Camera Config'] as Record<string, unknown>).state
    ).toBe(baseCameraState)
  })

  it('stops in-progress recording as a side effect', () => {
    const load3d = makeLoad3d()
    snapshotLoad3dState(makeNode(), load3d)
    expect(load3d.stopRecording).toHaveBeenCalledOnce()
  })

  it('returns model_3d_info as a single-element list when a model is loaded', () => {
    const info = makeModelInfo({ x: 1, y: 2, z: 3 })
    const result = snapshotLoad3dState(
      makeNode(),
      makeLoad3d({ modelInfo: info })
    )
    expect(result.model_3d_info).toEqual([info])
  })

  it('returns an empty model_3d_info list when no model is loaded', () => {
    const result = snapshotLoad3dState(
      makeNode(),
      makeLoad3d({ modelInfo: null })
    )
    expect(result.model_3d_info).toEqual([])
  })

  describe('with reactive node.properties (node data store proxy)', () => {
    it('records the camera state without notifying Camera Config watchers', async () => {
      const props = reactive<Record<string, unknown>>({
        'Camera Config': { cameraType: 'perspective', fov: 75, state: null }
      })
      const node = fromAny<LGraphNode, unknown>({ properties: props })
      let triggers = 0
      watch(
        () => props['Camera Config'],
        () => {
          triggers++
        },
        { deep: true }
      )

      const result = snapshotLoad3dState(node, makeLoad3d())
      await nextTick()

      expect(triggers).toBe(0)
      expect(result.camera_info).toBe(baseCameraState)
      expect(
        (toRaw(props)['Camera Config'] as Record<string, unknown>).state
      ).toBe(baseCameraState)
    })

    it('creates Camera Config without notifying watchers when it is absent', async () => {
      const props = reactive<Record<string, unknown>>({})
      const node = fromAny<LGraphNode, unknown>({ properties: props })
      let triggers = 0
      watch(
        () => props['Camera Config'],
        () => {
          triggers++
        },
        { deep: true }
      )

      snapshotLoad3dState(node, makeLoad3d({ fov: 42 }))
      await nextTick()

      expect(triggers).toBe(0)
      expect(toRaw(props)['Camera Config']).toMatchObject({
        cameraType: 'perspective',
        fov: 42,
        state: baseCameraState
      })
    })
  })
})

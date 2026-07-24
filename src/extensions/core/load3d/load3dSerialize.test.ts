import { describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type { CameraState } from '@/extensions/core/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

function makeNode(props: Record<string, unknown> = {}): LGraphNode {
  return { properties: { ...props } } as unknown as LGraphNode
}

const baseCameraState: CameraState = {
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
  cameraType: 'perspective'
} as unknown as CameraState

function makeLoad3d({
  cameraType = 'perspective',
  fov = 35,
  modelInfo = { transform: { position: [0, 0, 0] } } as unknown
}: {
  cameraType?: string
  fov?: number
  modelInfo?: unknown
} = {}) {
  return {
    getCurrentCameraType: vi.fn(() => cameraType),
    cameraManager: { perspectiveCamera: { fov } },
    getCameraState: vi.fn(() => baseCameraState),
    stopRecording: vi.fn(),
    getModelInfo: vi.fn(() => modelInfo)
  } as unknown as Load3d
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
    const info = { transform: { position: [1, 2, 3] } }
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
})

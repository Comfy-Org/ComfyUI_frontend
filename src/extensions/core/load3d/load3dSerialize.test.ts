import { describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import { snapshotLoad3dState } from '@/extensions/core/load3d/load3dSerialize'
import type { CameraState } from '@/extensions/core/load3d/interfaces'

const baseCameraState: CameraState = {
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
  cameraType: 'perspective'
} as unknown as CameraState

function makeLoad3d({
  cameraState = baseCameraState,
  modelInfo = { transform: { position: [0, 0, 0] } } as unknown
}: {
  cameraState?: CameraState
  modelInfo?: unknown
} = {}) {
  return {
    getCameraState: vi.fn(() => cameraState),
    stopRecording: vi.fn(),
    getModelInfo: vi.fn(() => modelInfo)
  } as unknown as Load3d
}

describe('snapshotLoad3dState', () => {
  it('returns only camera_info and model_3d_info', () => {
    const result = snapshotLoad3dState(makeLoad3d())
    expect(Object.keys(result).sort()).toEqual(['camera_info', 'model_3d_info'])
  })

  it('returns the current camera state as camera_info', () => {
    const cameraState = {
      ...baseCameraState,
      position: { x: 4, y: 5, z: 6 }
    } as unknown as CameraState
    const result = snapshotLoad3dState(makeLoad3d({ cameraState }))

    expect(result.camera_info).toBe(cameraState)
  })

  it('stops in-progress recording as a side effect', () => {
    const load3d = makeLoad3d()
    snapshotLoad3dState(load3d)
    expect(load3d.stopRecording).toHaveBeenCalledOnce()
  })

  it('returns model_3d_info as a single-element list when a model is loaded', () => {
    const info = { transform: { position: [1, 2, 3] } }
    const result = snapshotLoad3dState(makeLoad3d({ modelInfo: info }))
    expect(result.model_3d_info).toEqual([info])
  })

  it('returns an empty model_3d_info list when no model is loaded', () => {
    const result = snapshotLoad3dState(makeLoad3d({ modelInfo: null }))
    expect(result.model_3d_info).toEqual([])
  })
})

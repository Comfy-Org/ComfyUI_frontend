import { describe, expect, it } from 'vitest'

import {
  PREVIEW3D_CAMERA_AXIS_RESTORE_EPS,
  preview3dCameraStatesDiffer,
  preview3dRestoreCameraStatesMatch
} from '@e2e/fixtures/utils/preview3dCameraState'

const base = {
  cameraType: 'perspective',
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 1
}

describe('preview3dRestoreCameraStatesMatch', () => {
  it('returns true for identical states', () => {
    expect(preview3dRestoreCameraStatesMatch(base, { ...base })).toBe(true)
  })

  it('returns false for invalid payloads', () => {
    expect(preview3dRestoreCameraStatesMatch(null, base)).toBe(false)
    expect(preview3dRestoreCameraStatesMatch(base, { position: 'nope' })).toBe(
      false
    )
  })

  it('returns false when cameraType differs', () => {
    expect(
      preview3dRestoreCameraStatesMatch(base, { ...base, cameraType: 'ortho' })
    ).toBe(false)
  })

  it('accepts axis drift within PREVIEW3D_CAMERA_AXIS_RESTORE_EPS', () => {
    const drifted = {
      ...base,
      position: {
        x: base.position.x + PREVIEW3D_CAMERA_AXIS_RESTORE_EPS * 0.9,
        y: base.position.y,
        z: base.position.z
      }
    }
    expect(preview3dRestoreCameraStatesMatch(base, drifted)).toBe(true)
  })

  it('rejects axis drift beyond PREVIEW3D_CAMERA_AXIS_RESTORE_EPS', () => {
    const drifted = {
      ...base,
      position: {
        x: base.position.x + PREVIEW3D_CAMERA_AXIS_RESTORE_EPS * 1.1,
        y: base.position.y,
        z: base.position.z
      }
    }
    expect(preview3dRestoreCameraStatesMatch(base, drifted)).toBe(false)
  })
})

describe('preview3dCameraStatesDiffer', () => {
  it('treats missing typed state as different', () => {
    expect(preview3dCameraStatesDiffer(null, base, 1e-4)).toBe(true)
  })

  it('returns false when states are equal within eps', () => {
    expect(preview3dCameraStatesDiffer(base, { ...base }, 1e-4)).toBe(false)
  })
})

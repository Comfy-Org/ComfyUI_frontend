import { describe, expect, it } from 'vitest'

import { readModel3DOutput } from '@/extensions/core/load3d/model3dOutput'

const camera = {
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 0, z: 0 },
  zoom: 1,
  cameraType: 'perspective'
}
const transform = {
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 }
}

describe('readModel3DOutput', () => {
  it('reads the file, folder and viewer state from a 3d item', () => {
    const reported = readModel3DOutput({
      '3d': [
        { filename: 'ComfyUI_00001.glb', subfolder: '3d', type: 'output' }
      ],
      camera_info: [camera],
      model_3d_info: [transform]
    })

    expect(reported).toEqual({
      filePath: '3d/ComfyUI_00001.glb',
      folder: 'output',
      cameraState: camera,
      modelTransform: transform
    })
  })

  it('keeps a temp preview in the temp folder without a subfolder prefix', () => {
    const reported = readModel3DOutput({
      '3d': [{ filename: 'preview.glb', subfolder: '', type: 'temp' }],
      camera_info: [null],
      model_3d_info: []
    })

    expect(reported).toEqual({
      filePath: 'preview.glb',
      folder: 'temp',
      cameraState: undefined,
      modelTransform: undefined
    })
  })

  it('falls back to the positional result of older backends', () => {
    const reported = readModel3DOutput({
      result: ['3d/ComfyUI_00001.glb', camera, [transform]]
    })

    expect(reported).toEqual({
      filePath: '3d/ComfyUI_00001.glb',
      cameraState: camera,
      modelTransform: transform
    })
  })

  it('prefers the 3d item when both forms are present', () => {
    const reported = readModel3DOutput({
      '3d': [{ filename: 'new.glb', subfolder: '', type: 'output' }],
      result: ['old.glb']
    })

    expect(reported?.filePath).toBe('new.glb')
  })

  it('returns null when no file is reported', () => {
    expect(readModel3DOutput(undefined)).toBeNull()
    expect(readModel3DOutput(null)).toBeNull()
    expect(readModel3DOutput('3d/model.glb')).toBeNull()
    expect(readModel3DOutput({})).toBeNull()
    expect(readModel3DOutput({ '3d': [] })).toBeNull()
    expect(readModel3DOutput({ '3d': [{}] })).toBeNull()
    expect(readModel3DOutput({ result: [] })).toBeNull()
    expect(readModel3DOutput({ result: ['', camera] })).toBeNull()
  })

  it('rejects a file reference that is not a string', () => {
    expect(readModel3DOutput({ '3d': [{ filename: 42 }] })).toBeNull()
    expect(readModel3DOutput({ '3d': [{ filename: ['a.glb'] }] })).toBeNull()
    expect(readModel3DOutput({ result: [{ path: 'a.glb' }] })).toBeNull()
  })

  it.each([
    ['position', { target: camera.target, zoom: 1, cameraType: 'perspective' }],
    [
      'target',
      { position: camera.position, zoom: 1, cameraType: 'perspective' }
    ],
    [
      'zoom',
      {
        position: camera.position,
        target: camera.target,
        cameraType: 'perspective'
      }
    ],
    [
      'cameraType',
      { position: camera.position, target: camera.target, zoom: 1 }
    ]
  ])('drops a camera state missing %s', (_field, partialCamera) => {
    const reported = readModel3DOutput({
      '3d': [{ filename: 'a.glb', subfolder: '', type: 'output' }],
      camera_info: [partialCamera]
    })

    expect(reported?.cameraState).toBeUndefined()
  })

  it.each([
    ['quaternion', 'invalid'],
    ['customUp', { x: 0, y: 1 }],
    ['useCustomUp', 'yes'],
    ['fov', '35']
  ])('drops a camera state whose optional %s is malformed', (field, value) => {
    const reported = readModel3DOutput({
      '3d': [{ filename: 'a.glb', subfolder: '', type: 'output' }],
      camera_info: [{ ...camera, [field]: value }]
    })

    expect(reported?.cameraState).toBeUndefined()
  })

  it('keeps well-formed optional camera fields', () => {
    const quaternion = { x: 0, y: 0, z: 0, w: 1 }
    const reported = readModel3DOutput({
      '3d': [{ filename: 'a.glb', subfolder: '', type: 'output' }],
      camera_info: [{ ...camera, quaternion, useCustomUp: true }]
    })

    expect(reported?.cameraState).toMatchObject({
      quaternion,
      useCustomUp: true
    })
  })

  it('drops viewer state that does not have the expected shape', () => {
    const reported = readModel3DOutput({
      '3d': [{ filename: 'a.glb', subfolder: '', type: 'input' }],
      camera_info: [{ position: { x: 1, y: 2, z: 3 } }],
      model_3d_info: [{ scale: { x: 1, y: 1, z: 1 } }]
    })

    expect(reported).toEqual({
      filePath: 'a.glb',
      folder: undefined,
      cameraState: undefined,
      modelTransform: undefined
    })
  })

  it('rejects a file item whose fields are malformed', () => {
    expect(
      readModel3DOutput({ '3d': [{ filename: 'a.glb', subfolder: 7 }] })
    ).toBeNull()
    expect(
      readModel3DOutput({ '3d': [{ filename: 'a.glb', type: 'nowhere' }] })
    ).toBeNull()
  })
})

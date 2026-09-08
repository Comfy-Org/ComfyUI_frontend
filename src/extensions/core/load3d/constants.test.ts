import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'
import { describe, expect, it } from 'vitest'

import { SUPPORTED_EXTENSIONS, getExportFormatOptions } from './constants'

describe('getExportFormatOptions', () => {
  it('returns the convertible mesh formats for mesh sources', () => {
    expect(getExportFormatOptions('glb').map((o) => o.value)).toEqual([
      'glb',
      'obj',
      'stl',
      'fbx'
    ])
  })

  it('returns the convertible mesh formats when the source is unknown', () => {
    expect(getExportFormatOptions(null).map((o) => o.value)).toEqual([
      'glb',
      'obj',
      'stl',
      'fbx'
    ])
  })

  it.each(['ply', 'spz', 'splat', 'ksplat'])(
    'offers only the source format for direct-export type %s',
    (format) => {
      expect(getExportFormatOptions(format)).toEqual([
        { label: format.toUpperCase(), value: format }
      ])
    }
  )

  it('matches direct-export formats case-insensitively', () => {
    expect(getExportFormatOptions('PLY')).toEqual([
      { label: 'PLY', value: 'ply' }
    ])
  })
})

describe('Assets browser recognizes every Load3D-uploadable format', () => {
  // Guards against the classifier (shared-frontend-utils) drifting out of sync
  // with the formats Load3D accepts. A format Load3D can load but the Assets
  // browser tags as 'other' gets no 3D preview and can't be opened in the
  // 3D viewer.
  it.each([...SUPPORTED_EXTENSIONS])(
    'classifies %s uploads as 3D media',
    (ext) => {
      expect(getMediaTypeFromFilename(`model${ext}`)).toBe('3D')
    }
  )
})

import { describe, expect, it } from 'vitest'

import { getExportFormatOptions } from './constants'

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

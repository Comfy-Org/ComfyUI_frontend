import { describe, expect, it } from 'vitest'

import { detectNodeTypeFromFilename } from './loaderNodeUtil'

describe('detectNodeTypeFromFilename', () => {
  it.for(['image.png', 'sky.exr', 'sky.HDR'])(
    'loads %s with LoadImage',
    (filename) => {
      expect(detectNodeTypeFromFilename(filename)).toEqual({
        nodeType: 'LoadImage',
        widgetName: 'image'
      })
    }
  )

  it('has no loader for 3D files', () => {
    expect(detectNodeTypeFromFilename('mesh.glb').nodeType).toBeNull()
  })
})

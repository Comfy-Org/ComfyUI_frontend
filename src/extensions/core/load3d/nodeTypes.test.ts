import { describe, expect, it } from 'vitest'

import {
  isLoad3dNode,
  isLoad3dResultViewerNode,
  isThreeJsNode
} from './nodeTypes'

describe('load3d node types', () => {
  it.for(['CreateCameraInfo', 'CameraAngle', 'CreateLightInfo'])(
    'treats %s as a three.js node without making it a Load3D node',
    (nodeType) => {
      expect(isThreeJsNode(nodeType)).toBe(true)
      expect(isLoad3dNode(nodeType)).toBe(false)
      expect(isLoad3dResultViewerNode(nodeType)).toBe(false)
    }
  )

  it('keeps Load3D viewers as three.js nodes and ignores unrelated nodes', () => {
    expect(isThreeJsNode('Preview3D')).toBe(true)
    expect(isLoad3dResultViewerNode('Preview3D')).toBe(true)
    expect(isThreeJsNode('KSampler')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { supportsVirtualCanvasImagePreview } from './canvasImagePreviewTypes'

function createNodeWithFlag(flag?: boolean): LGraphNode {
  const node = new LGraphNode('TestNode')
  const ctor = node.constructor as typeof LGraphNode
  ctor.nodeData = flag !== undefined ? { canvas_image_preview: flag } : {}
  return node
}

describe('supportsVirtualCanvasImagePreview', () => {
  it('returns true when nodeData.canvas_image_preview is true', () => {
    const node = createNodeWithFlag(true)
    expect(supportsVirtualCanvasImagePreview(node)).toBe(true)
  })

  it('returns false when nodeData.canvas_image_preview is false', () => {
    const node = createNodeWithFlag(false)
    expect(supportsVirtualCanvasImagePreview(node)).toBe(false)
  })

  it('returns false when nodeData.canvas_image_preview is not set', () => {
    const node = createNodeWithFlag()
    expect(supportsVirtualCanvasImagePreview(node)).toBe(false)
  })

  it('returns false when nodeData is undefined', () => {
    const node = new LGraphNode('TestNode')
    const ctor = node.constructor as typeof LGraphNode
    ctor.nodeData = undefined
    expect(supportsVirtualCanvasImagePreview(node)).toBe(false)
  })
})

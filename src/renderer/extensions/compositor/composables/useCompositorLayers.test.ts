import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import {
  clearCompositorLayers,
  clearCompositorPreviewOverride,
  getCompositorBBoxes,
  getCompositorInputsFingerprint,
  getCompositorLayers,
  getCompositorPreviewOverride,
  hasCompositorLayers,
  setCompositorLayers,
  setCompositorPreviewOverride
} from './useCompositorLayers'

const layerRef = { filename: 'a.png', subfolder: '', type: 'temp' }
const bbox = { x: 10, y: 20, width: 30, height: 40, name: 'Subject' }
const node = { id: toNodeId(1), graph: null } as unknown as LGraphNode
const subgraphNode = {
  id: toNodeId(1),
  graph: { isRootGraph: false, id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
} as unknown as LGraphNode

describe('useCompositorLayers', () => {
  beforeEach(() => {
    clearCompositorLayers(node)
    clearCompositorLayers(subgraphNode)
  })

  it('stores and returns layer refs per node', () => {
    expect(getCompositorLayers(node)).toBeUndefined()
    expect(hasCompositorLayers(node)).toBe(false)

    setCompositorLayers(node, [layerRef])
    expect(getCompositorLayers(node)).toEqual([layerRef])
    expect(hasCompositorLayers(node)).toBe(true)
  })

  it('keeps a subgraph node separate from a root node with the same local id', () => {
    const subgraphRef = { filename: 'b.png', subfolder: '', type: 'temp' }
    setCompositorLayers(node, [layerRef])
    expect(hasCompositorLayers(subgraphNode)).toBe(false)

    setCompositorLayers(subgraphNode, [subgraphRef])
    expect(getCompositorLayers(node)).toEqual([layerRef])
    expect(getCompositorLayers(subgraphNode)).toEqual([subgraphRef])

    clearCompositorLayers(subgraphNode)
    expect(hasCompositorLayers(node)).toBe(true)
  })

  it('treats an empty ref list as not openable', () => {
    setCompositorLayers(node, [])
    expect(hasCompositorLayers(node)).toBe(false)
  })

  it('clears refs for a node', () => {
    setCompositorLayers(node, [layerRef])
    clearCompositorLayers(node)
    expect(getCompositorLayers(node)).toBeUndefined()
    expect(hasCompositorLayers(node)).toBe(false)
  })

  it('stores the inputs fingerprint alongside the layers', () => {
    setCompositorLayers(node, [layerRef], ['hash-a', 'hash-b'])
    expect(getCompositorInputsFingerprint(node)).toEqual(['hash-a', 'hash-b'])
  })

  it('drops a previous fingerprint when layers are set without one', () => {
    setCompositorLayers(node, [layerRef], ['hash-a'])
    setCompositorLayers(node, [layerRef])
    expect(getCompositorInputsFingerprint(node)).toBeUndefined()
  })

  it('clears the fingerprint together with the layers', () => {
    setCompositorLayers(node, [layerRef], ['hash-a'])
    clearCompositorLayers(node)
    expect(getCompositorInputsFingerprint(node)).toBeUndefined()
  })

  it('stores bboxes alongside the layers, keeping null entries', () => {
    setCompositorLayers(node, [layerRef], ['hash-a'], [bbox, null])
    expect(getCompositorBBoxes(node)).toEqual([bbox, null])
  })

  it('drops previous bboxes when layers are set without them', () => {
    setCompositorLayers(node, [layerRef], ['hash-a'], [bbox])
    setCompositorLayers(node, [layerRef], ['hash-a'])
    expect(getCompositorBBoxes(node)).toBeUndefined()
  })

  it('clears bboxes together with the layers', () => {
    setCompositorLayers(node, [layerRef], ['hash-a'], [bbox])
    clearCompositorLayers(node)
    expect(getCompositorBBoxes(node)).toBeUndefined()
  })

  it('stores, replaces and clears the preview override per node', () => {
    expect(getCompositorPreviewOverride(node)).toBeUndefined()
    setCompositorPreviewOverride(node, 'blob:first')
    expect(getCompositorPreviewOverride(node)).toBe('blob:first')
    setCompositorPreviewOverride(node, 'blob:second')
    expect(getCompositorPreviewOverride(node)).toBe('blob:second')
    clearCompositorPreviewOverride(node)
    expect(getCompositorPreviewOverride(node)).toBeUndefined()
  })

  it('revokes replaced and cleared blob object urls', () => {
    const revoke = vi.fn()
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = revoke
    try {
      setCompositorPreviewOverride(node, 'blob:a')
      setCompositorPreviewOverride(node, 'blob:b')
      expect(revoke).toHaveBeenCalledWith('blob:a')
      clearCompositorLayers(node)
      expect(revoke).toHaveBeenCalledWith('blob:b')
    } finally {
      URL.revokeObjectURL = original
    }
  })
})

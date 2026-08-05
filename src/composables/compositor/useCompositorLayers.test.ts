import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const nodeId = toNodeId(1)

describe('useCompositorLayers', () => {
  beforeEach(() => {
    clearCompositorLayers(nodeId)
  })

  it('stores and returns layer refs per node id', () => {
    expect(getCompositorLayers(nodeId)).toBeUndefined()
    expect(hasCompositorLayers(nodeId)).toBe(false)

    setCompositorLayers(nodeId, [layerRef])
    expect(getCompositorLayers(nodeId)).toEqual([layerRef])
    expect(hasCompositorLayers(nodeId)).toBe(true)
  })

  it('treats an empty ref list as not openable', () => {
    setCompositorLayers(nodeId, [])
    expect(hasCompositorLayers(nodeId)).toBe(false)
  })

  it('clears refs for a node', () => {
    setCompositorLayers(nodeId, [layerRef])
    clearCompositorLayers(nodeId)
    expect(getCompositorLayers(nodeId)).toBeUndefined()
    expect(hasCompositorLayers(nodeId)).toBe(false)
  })

  it('stores the inputs fingerprint alongside the layers', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a', 'hash-b'])
    expect(getCompositorInputsFingerprint(nodeId)).toEqual(['hash-a', 'hash-b'])
  })

  it('drops a previous fingerprint when layers are set without one', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a'])
    setCompositorLayers(nodeId, [layerRef])
    expect(getCompositorInputsFingerprint(nodeId)).toBeUndefined()
  })

  it('clears the fingerprint together with the layers', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a'])
    clearCompositorLayers(nodeId)
    expect(getCompositorInputsFingerprint(nodeId)).toBeUndefined()
  })

  it('stores bboxes alongside the layers, keeping null entries', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a'], [bbox, null])
    expect(getCompositorBBoxes(nodeId)).toEqual([bbox, null])
  })

  it('drops previous bboxes when layers are set without them', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a'], [bbox])
    setCompositorLayers(nodeId, [layerRef], ['hash-a'])
    expect(getCompositorBBoxes(nodeId)).toBeUndefined()
  })

  it('clears bboxes together with the layers', () => {
    setCompositorLayers(nodeId, [layerRef], ['hash-a'], [bbox])
    clearCompositorLayers(nodeId)
    expect(getCompositorBBoxes(nodeId)).toBeUndefined()
  })

  it('stores, replaces and clears the preview override per node', () => {
    expect(getCompositorPreviewOverride(nodeId)).toBeUndefined()
    setCompositorPreviewOverride(nodeId, 'blob:first')
    expect(getCompositorPreviewOverride(nodeId)).toBe('blob:first')
    setCompositorPreviewOverride(nodeId, 'blob:second')
    expect(getCompositorPreviewOverride(nodeId)).toBe('blob:second')
    clearCompositorPreviewOverride(nodeId)
    expect(getCompositorPreviewOverride(nodeId)).toBeUndefined()
  })

  it('revokes replaced and cleared blob object urls', () => {
    const revoke = vi.fn()
    const original = URL.revokeObjectURL
    URL.revokeObjectURL = revoke
    try {
      setCompositorPreviewOverride(nodeId, 'blob:a')
      setCompositorPreviewOverride(nodeId, 'blob:b')
      expect(revoke).toHaveBeenCalledWith('blob:a')
      clearCompositorLayers(nodeId)
      expect(revoke).toHaveBeenCalledWith('blob:b')
    } finally {
      URL.revokeObjectURL = original
    }
  })
})

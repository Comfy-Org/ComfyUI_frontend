import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: vi.fn(() => ({
      value: {
        id: '1',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        zIndex: 0,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      }
    })),
    applyOperation: vi.fn(),
    getCurrentSource: vi.fn(() => 'canvas'),
    getCurrentActor: vi.fn(() => 'test'),
    setSource: vi.fn(),
    setActor: vi.fn(),
    batchUpdateNodeBounds: vi.fn()
  }
}))

describe('LGraphNode geometry mutation guards', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14
    })

    node = new LGraphNode('TestNode')
    node.id = 1
    vi.clearAllMocks()
  })

  describe('pos setter triggers store mutation', () => {
    it('calls moveNode on layoutStore via pos setter', () => {
      node.pos = [200, 300]

      expect(layoutStore.applyOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'moveNode',
          nodeId: '1',
          position: { x: 200, y: 300 }
        })
      )
    })

    it('calls moveNode on layoutStore via setPos', () => {
      node.setPos(400, 500)

      expect(layoutStore.applyOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'moveNode',
          nodeId: '1',
          position: { x: 400, y: 500 }
        })
      )
    })
  })

  describe('size setter triggers store mutation', () => {
    it('calls resizeNode on layoutStore via size setter', () => {
      node.size = [250, 150]

      expect(layoutStore.applyOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'resizeNode',
          nodeId: '1',
          size: { width: 250, height: 150 }
        })
      )
    })
  })

  describe('applyStoreProjection bypasses store mutations', () => {
    it('updates backing arrays without triggering store writes', () => {
      node.applyStoreProjection({ x: 300, y: 400 }, { width: 500, height: 200 })

      expect(node.pos[0]).toBe(300)
      expect(node.pos[1]).toBe(400)
      expect(node.size[0]).toBe(500)
      expect(node.size[1]).toBe(200)

      // Must NOT have triggered any store operations
      expect(layoutStore.applyOperation).not.toHaveBeenCalled()
    })

    it('returns true when values changed', () => {
      const changed = node.applyStoreProjection(
        { x: 999, y: 888 },
        { width: 777, height: 666 }
      )
      expect(changed).toBe(true)
    })

    it('returns false when values are unchanged', () => {
      node.applyStoreProjection({ x: 100, y: 200 }, { width: 300, height: 400 })
      vi.clearAllMocks()

      const changed = node.applyStoreProjection(
        { x: 100, y: 200 },
        { width: 300, height: 400 }
      )
      expect(changed).toBe(false)
      expect(layoutStore.applyOperation).not.toHaveBeenCalled()
    })

    it('calls onResize when size changes', () => {
      const onResize = vi.fn()
      node.onResize = onResize

      node.applyStoreProjection({ x: 0, y: 0 }, { width: 999, height: 888 })

      expect(onResize).toHaveBeenCalledOnce()
    })

    it('does not call onResize when only position changes', () => {
      const onResize = vi.fn()
      node.onResize = onResize

      // Set initial size
      node.applyStoreProjection({ x: 0, y: 0 }, { width: 100, height: 50 })
      onResize.mockClear()

      // Change only position
      node.applyStoreProjection({ x: 999, y: 888 }, { width: 100, height: 50 })

      expect(onResize).not.toHaveBeenCalled()
    })
  })

  describe('presentation property setters fire events', () => {
    it('title setter fires node:property:changed', () => {
      const graph = { trigger: vi.fn() }
      node.graph = graph as unknown as LGraphNode['graph']

      node.title = 'New Title'

      expect(graph.trigger).toHaveBeenCalledWith(
        'node:property:changed',
        expect.objectContaining({
          nodeId: node.id,
          property: 'title',
          newValue: 'New Title'
        })
      )
    })

    it('mode setter fires node:property:changed', () => {
      const graph = { trigger: vi.fn() }
      node.graph = graph as unknown as LGraphNode['graph']

      node.mode = 2

      expect(graph.trigger).toHaveBeenCalledWith(
        'node:property:changed',
        expect.objectContaining({
          nodeId: node.id,
          property: 'mode',
          newValue: 2
        })
      )
    })

    it('shape setter fires node:property:changed', () => {
      const graph = { trigger: vi.fn() }
      node.graph = graph as unknown as LGraphNode['graph']

      node.shape = 'round'

      expect(graph.trigger).toHaveBeenCalledWith(
        'node:property:changed',
        expect.objectContaining({
          nodeId: node.id,
          property: 'shape'
        })
      )
    })

    it('title setter fires even when value is unchanged (LGraphNodeProperties instruments unconditionally)', () => {
      // Note: LGraphNodeProperties replaces class-level setters with
      // instrumented descriptors that fire on every write. The class
      // setter's oldValue !== value guard is bypassed. A future phase
      // should add dedup logic to _emitPropertyChange.
      const graph = { trigger: vi.fn() }
      node.graph = graph as unknown as LGraphNode['graph']

      node.title = 'Same'
      graph.trigger.mockClear()

      node.title = 'Same'
      expect(graph.trigger).toHaveBeenCalledOnce()
    })

    it('mode setter fires even when value is unchanged (LGraphNodeProperties instruments unconditionally)', () => {
      const graph = { trigger: vi.fn() }
      node.graph = graph as unknown as LGraphNode['graph']

      node.mode = 4
      graph.trigger.mockClear()

      node.mode = 4
      expect(graph.trigger).toHaveBeenCalledOnce()
    })
  })
})

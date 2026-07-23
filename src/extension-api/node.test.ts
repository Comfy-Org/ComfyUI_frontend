import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { createNodeHandle } from './node'

const NODE = toNodeId('7')

function mockNode(comfyClass = 'KSampler') {
  return createMockLGraphNode({ id: NODE, comfyClass, size: [100, 50] })
}

describe('createNodeHandle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    layoutStore.initializeFromLiteGraph([
      { id: NODE, pos: [0, 0], size: [100, 50] }
    ])
  })

  it('exposes the node id and type', () => {
    const handle = createNodeHandle(mockNode())
    expect(handle.id).toBe(NODE)
    expect(handle.type).toBe('KSampler')
  })

  describe('getSize', () => {
    it('reads the current size from the layout store as a tuple', () => {
      expect(createNodeHandle(mockNode()).getSize()).toEqual([100, 50])
    })
  })

  describe('setSize', () => {
    it('resizes the node in layoutStore with the External source', () => {
      const sourceBefore = layoutStore.getCurrentSource()
      const resizeSources: LayoutSource[] = []
      // Node-scoped listeners fire synchronously (global onChange is queued).
      const unsubscribe = layoutStore.onNodeChange(NODE, (change) => {
        if (change.operation.type === 'resizeNode') {
          resizeSources.push(change.source)
        }
      })

      createNodeHandle(mockNode()).setSize([250, 180])
      unsubscribe()

      expect(layoutStore.getNodeLayoutRef(NODE).value?.size).toEqual({
        width: 250,
        height: 180
      })
      // The resize operation itself is tagged External...
      expect(resizeSources).toEqual([LayoutSource.External])
      // ...but the shared source state is restored so later mutations on the
      // same store are not mislabeled.
      expect(layoutStore.getCurrentSource()).toBe(sourceBefore)
    })

    it('applies a deferred resize once the node is registered in the layout store', async () => {
      // A handle can be created (and setSize called from `nodeCreated`) before
      // the node exists in the layout store — during graph load, layout
      // creation is deferred to onAfterGraphConfigured. Regression guard for
      // the resize being silently dropped in that window.
      const LATE = toNodeId('99')
      const handle = createNodeHandle(
        createMockLGraphNode({
          id: LATE,
          comfyClass: 'KSampler',
          size: [100, 50]
        })
      )
      expect(layoutStore.getNodeLayoutRef(LATE).value).toBeNull()

      handle.setSize([250, 180])
      // No layout entry yet → nothing applied.
      expect(layoutStore.getNodeLayoutRef(LATE).value).toBeNull()

      // Node registered later (as onAfterGraphConfigured seeds it from the
      // node's own size); the deferred resize now flushes through the store.
      const mutations = useLayoutMutations()
      mutations.createNode(LATE, {
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        zIndex: 0,
        visible: true
      })
      await nextTick()

      expect(layoutStore.getNodeLayoutRef(LATE).value?.size).toEqual({
        width: 250,
        height: 180
      })
    })

    it.for([
      { name: 'NaN width', size: [Number.NaN, 180] as const },
      {
        name: 'infinite height',
        size: [250, Number.POSITIVE_INFINITY] as const
      }
    ])('is a no-op for non-finite dimensions: $name', ({ size }) => {
      const sizeBefore = { ...layoutStore.getNodeLayoutRef(NODE).value?.size }
      const sourceBefore = layoutStore.getCurrentSource()

      createNodeHandle(mockNode()).setSize([size[0], size[1]])

      expect(layoutStore.getNodeLayoutRef(NODE).value?.size).toEqual(sizeBefore)
      expect(layoutStore.getCurrentSource()).toBe(sourceBefore)
    })
  })

  describe('not-yet-implemented stubs', () => {
    it('autosize throws referencing the follow-up', () => {
      expect(() => createNodeHandle(mockNode()).autosize()).toThrow(
        /not implemented yet/i
      )
    })

    it("on('resize') throws referencing the follow-up", () => {
      expect(() => createNodeHandle(mockNode()).on('resize', () => {})).toThrow(
        /not implemented yet/i
      )
    })
  })
})

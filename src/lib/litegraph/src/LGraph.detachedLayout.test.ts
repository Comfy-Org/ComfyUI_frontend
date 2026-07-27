import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('layout writes from a detached graph', () => {
  it('leaves the open workflow geometry alone', () => {
    const open = new LGraph()
    const openGroup = new LGraphGroup('open')
    openGroup.pos = [100, 200]
    open.add(openGroup)

    const openNode = new LGraphNode('open')
    open.add(openNode)
    useLayoutMutations().createNode(openNode.id, {
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 }
    })

    // What `insertWorkflow` does: build a graph purely to serialise it, then
    // throw it away. Its ids start at 1, colliding with the open workflow's.
    layoutStore.whileDetached(() => {
      const detached = new LGraph()
      const detachedGroup = new LGraphGroup('detached')
      detachedGroup.pos = [999, 999]
      detached.add(detachedGroup)

      const detachedNode = new LGraphNode('detached')
      detached.add(detachedNode)
      detachedNode.pos = [999, 888]

      expect(detachedGroup.id).toBe(openGroup.id)
      expect(detachedNode.id).toBe(openNode.id)

      detached.clear()
    })

    expect(layoutStore.getGroupLayout(openGroup.id)?.position).toEqual({
      x: 100,
      y: 200
    })
    expect(layoutStore.getNodeLayoutRef(openNode.id).value?.position).toEqual({
      x: 10,
      y: 20
    })
  })
})

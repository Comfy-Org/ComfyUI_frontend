import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { createUuidv4 } from '@/utils/uuid'

/**
 * `layoutStore` holds the layout of one root graph, and scoping it is sticky —
 * these live apart from `LGraph.test.ts` so the scope cannot leak into tests
 * that expect an unscoped store.
 */
beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('Layout scope across root graphs', () => {
  it('a graph off to the side does not delete the open workflow group layout', () => {
    const open = new LGraph()
    open.id = createUuidv4()
    layoutStore.setRootGraphId(open.rootGraph.id)

    const openGroup = new LGraphGroup('open')
    openGroup.pos = [100, 200]
    open.add(openGroup)

    const detached = new LGraph()
    detached.id = createUuidv4()
    const detachedGroup = new LGraphGroup('detached')
    detachedGroup.pos = [999, 999]
    detached.add(detachedGroup)
    expect(detachedGroup.id).toBe(openGroup.id)

    detached.clear()

    expect(layoutStore.getGroupLayout(openGroup.id)?.position).toEqual({
      x: 100,
      y: 200
    })
  })

  it('a graph off to the side does not move the open workflow node layout', () => {
    const open = new LGraph()
    open.id = createUuidv4()
    const openNode = new LGraphNode('open')
    open.add(openNode)
    layoutStore.initializeFromLiteGraph(
      [{ id: openNode.id, pos: [100, 200], size: [140, 60] }],
      open.rootGraph.id
    )

    const detached = new LGraph()
    detached.id = createUuidv4()
    const detachedNode = new LGraphNode('detached')
    detached.add(detachedNode)
    expect(detachedNode.id).toBe(openNode.id)

    detachedNode.pos = [999, 888]

    expect(layoutStore.getNodeLayoutRef(openNode.id).value?.position).toEqual({
      x: 100,
      y: 200
    })
  })
})

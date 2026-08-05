import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { arrangeForLegacyRender } from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'
import { canvasLayoutMutations } from '@/renderer/core/layout/operations/graphLayoutRegistration'

function addedNode(graph: LGraph) {
  const node = new LGraphNode('widgets')
  node.addInput('image', 'IMAGE')
  node.addWidget('number', 'seed', 0, () => {})
  graph.add(node)
  return node
}

describe('arrangeForLegacyRender', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('arranges nodes after Vue rendering clears the legacy draw gate', () => {
    const graph = new LGraph()
    const node = addedNode(graph)

    LiteGraph.vueNodesMode = true
    node.arrange()

    expect(node._widgetSlotsDirty).toBe(false)

    LiteGraph.vueNodesMode = false
    expect(() => arrangeForLegacyRender(graph)).not.toThrow()
  })

  it('leaves collapsed nodes alone', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    node.flags.collapsed = true
    node._widgetSlotsDirty = true

    arrangeForLegacyRender(graph)

    expect(node._widgetSlotsDirty).toBe(true)
  })

  it('projects authoritative z-index into legacy node order', () => {
    const graph = new LGraph()
    const first = addedNode(graph)
    const second = addedNode(graph)
    const mutations = canvasLayoutMutations()
    mutations.setNodeZIndex(graph.id, first.id, 2)
    mutations.setNodeZIndex(graph.id, second.id, 1)

    arrangeForLegacyRender(graph)

    expect(graph._nodes).toEqual([second, first])
  })
})

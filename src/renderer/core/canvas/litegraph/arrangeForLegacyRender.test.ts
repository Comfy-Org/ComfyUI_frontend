import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { arrangeForLegacyRender } from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'

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

  it('runs where the drawConnections gate cannot', () => {
    const graph = new LGraph()
    const node = addedNode(graph)

    LiteGraph.vueNodesMode = true
    node.arrange()

    // drawConnections only arranges nodes with `_widgetSlotsDirty` set, and
    // Vue-mode drawNode arranges every visible node every frame, so the gate
    // is always clear by the time the renderer switches.
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
})

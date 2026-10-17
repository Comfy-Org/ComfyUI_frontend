import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import { useWidgetHostNode } from './useWidgetHostNode'

vi.mock(import('@/scripts/app'))

function addNode(graph: LGraph) {
  const node = new LGraphNode('Host')
  graph.add(node)
  return node
}

describe('useWidgetHostNode', () => {
  it('resolves the node from the widget locator', () => {
    const node = addNode(app.rootGraph)
    const widget = { nodeLocatorId: createNodeLocatorId(null, node.id) }

    expect(useWidgetHostNode(widget, node.id).value).toBe(node)
  })

  it('falls back to the node id in the graph shown on the canvas', () => {
    const shown = new LGraph()
    const node = addNode(shown)
    app.canvas.setGraph(shown)

    expect(useWidgetHostNode({}, node.id).value).toBe(node)
  })
})

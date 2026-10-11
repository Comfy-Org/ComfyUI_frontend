import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { serializeNodeId } from '@/types/nodeId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

describe('LGraphCanvas highlighted nodes', () => {
  it('draws the selected outline without changing graph selection', () => {
    const context = createMockCanvasRenderingContext2D()
    const graph = new LGraph()
    const canvas = createTestCanvas(graph, context)
    const node = new LGraphNode('Referenced node')
    graph.add(node)
    canvas.highlighted_node_ids.add(serializeNodeId(node.id))

    canvas.drawNode(node, context)

    expect(context.stroke).toHaveBeenCalledOnce()
    expect(node.selected).toBe(false)
  })
})

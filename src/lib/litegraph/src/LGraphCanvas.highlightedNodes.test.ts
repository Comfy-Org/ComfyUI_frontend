import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeHighlightStore } from '@/renderer/core/canvas/nodeHighlightStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

describe('LGraphCanvas highlighted nodes', () => {
  it('outlines only the highlighted node, without changing graph selection', () => {
    const context = createMockCanvasRenderingContext2D()
    const graph = new LGraph()
    const canvas = createTestCanvas(graph, context)
    const node = new LGraphNode('Referenced node')
    const other = new LGraphNode('Other node')
    graph.add(node)
    graph.add(other)
    useNodeHighlightStore().setHighlightedNodeIds([node.id])

    canvas.drawNode(other, context)

    expect(context.stroke).not.toHaveBeenCalled()

    canvas.drawNode(node, context)

    expect(context.stroke).toHaveBeenCalledOnce()
    expect(node.selected).toBe(false)
  })
})

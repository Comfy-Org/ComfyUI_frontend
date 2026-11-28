import { effectScope } from 'vue'
import { describe, expect, it, onTestFinished } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

import { useNodeEmphasis, useNodeEmphasisSource } from './nodeEmphasisSystem'

describe('node emphasis on the legacy canvas', () => {
  it('outlines only the referenced node, without changing graph selection', () => {
    const context = createMockCanvasRenderingContext2D()
    const graph = new LGraph()
    const canvas = createTestCanvas(graph, context)
    const node = new LGraphNode('Referenced node')
    const other = new LGraphNode('Other node')
    graph.add(node)
    graph.add(other)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    scope.run(() => {
      useNodeEmphasis()
      useNodeEmphasisSource(() => node.id)
    })

    canvas.drawNode(other, context)

    expect(context.stroke).not.toHaveBeenCalled()

    canvas.drawNode(node, context)

    expect(context.stroke).toHaveBeenCalledOnce()
    expect(node.selected).toBe(false)

    scope.stop()
    canvas.drawNode(node, context)

    expect(context.stroke).toHaveBeenCalledOnce()
  })
})

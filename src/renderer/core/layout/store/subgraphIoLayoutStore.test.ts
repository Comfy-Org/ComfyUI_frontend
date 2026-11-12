import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { resolvePointerTarget } from '@/lib/litegraph/src/canvas/resolvePointerTarget'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { useSubgraphIoLayoutStore } from './subgraphIoLayoutStore'

describe('subgraph IO renderer measurements', () => {
  it('targets the visible IO surface ahead of an interior node behind it', () => {
    stubCanvasGetContext()
    onTestFinished(() =>
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore()
    )
    const graph = createTestSubgraph()
    graph.inputNode.pos = [100, 200]
    useSubgraphIoLayoutStore().report(graph.id, graph.inputNode.id, {
      width: 320,
      height: 400,
      slotTop: 36
    })
    graph.inputNode.arrange()
    const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
      skip_render: true,
      skip_events: true
    })
    const interior = new LGraphNode('Interior')
    graph.add(interior)
    interior.pos = [100, 200]
    const event = Object.assign(new PointerEvent('pointerdown'), {
      canvasX: 150,
      canvasY: 250,
      deltaX: 0,
      deltaY: 0,
      safeOffsetX: 150,
      safeOffsetY: 250
    })

    expect(resolvePointerTarget(canvas, graph, event, interior)).toEqual({
      kind: 'subgraphIO',
      ioNode: graph.inputNode
    })
    useSubgraphIoLayoutStore().clear(graph.id, graph.inputNode.id)
    expect(resolvePointerTarget(canvas, graph, event, interior)).toEqual({
      kind: 'node',
      node: interior
    })
  })
  it('keeps connection anchors aligned with a measured node and the final empty port', () => {
    const graph = createTestSubgraph()
    graph.addInput('first', 'STRING')
    graph.addInput('second', 'STRING')
    const node = graph.inputNode
    node.pos = [100, 200]
    node.size = [128, 100]
    const savedBounds = node.asSerialisable().bounding
    const layouts = useSubgraphIoLayoutStore()
    layouts.report(graph.id, node.id, {
      width: 320,
      height: 400,
      slotTop: 36
    })

    node.arrange()

    expect(node.allSlots.map((slot) => [...slot.pos])).toEqual([
      [204, 246],
      [204, 266],
      [204, 286]
    ])
    expect([...node.boundingRect.size]).toEqual([344, 400])
    expect(node.asSerialisable().bounding).toEqual(savedBounds)
    expect(node.allSlots.at(-1)).toBe(node.emptySlot)
    expect(graph.outputNode.boundingRect[2]).not.toBe(344)
    expect(node.allSlots[0].boundingRect[3]).toBe(LiteGraph.NODE_SLOT_HEIGHT)
  })

  it('isolates measurements by definition and restores the canvas layout on unmount', () => {
    const first = createTestSubgraph()
    const second = createTestSubgraph()
    const layouts = useSubgraphIoLayoutStore()
    layouts.report(first.id, first.inputNode.id, {
      width: 320,
      height: 400,
      slotTop: 36
    })
    first.inputNode.arrange()
    second.inputNode.arrange()

    expect(first.inputNode.boundingRect[3]).toBe(400)
    expect(second.inputNode.boundingRect[3]).not.toBe(400)
    layouts.clear(first.id, first.inputNode.id)
    first.inputNode.arrange()

    expect(first.inputNode.boundingRect[3]).not.toBe(400)
  })
})

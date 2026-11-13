import { describe, expect, it } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'

import { useSubgraphIoLayout } from '@/components/graph/subgraph/useSubgraphIoLayout'
import { resolvePointerTarget } from '@/lib/litegraph/src/canvas/resolvePointerTarget'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { useSubgraphIoLayoutStore } from './subgraphIoLayoutStore'

describe('subgraph IO renderer measurements', () => {
  it('targets the visible IO surface ahead of an interior node behind it', () => {
    stubCanvasGetContext()
    const graph = createTestSubgraph()
    graph.inputNode.pos = [100, 200]
    useSubgraphIoLayoutStore().report(graph.inputNode, {
      offsetX: 0,
      width: 320,
      height: 400,
      slotCenters: []
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
    useSubgraphIoLayoutStore().clear(graph.inputNode)
    expect(resolvePointerTarget(canvas, graph, event, interior)).toEqual({
      kind: 'node',
      node: interior
    })
  })

  it('anchors each connection on the panel edge at its measured row center', () => {
    const graph = createTestSubgraph()
    graph.addInput('first', 'STRING')
    graph.addInput('second', 'STRING')
    const node = graph.inputNode
    node.pos = [100, 200]
    node.size = [128, 100]
    const savedBounds = node.asSerialisable().bounding
    useSubgraphIoLayoutStore().report(node, {
      offsetX: -192,
      width: 320,
      height: 400,
      slotCenters: [40, 72, 140]
    })

    node.arrange()

    expect(node.allSlots.map((slot) => [...slot.pos])).toEqual([
      [228, 240],
      [228, 272],
      [228, 340]
    ])
    expect([...node.boundingRect]).toEqual([-92, 200, 320, 400])
    expect(node.asSerialisable().bounding).toEqual(savedBounds)
  })

  it('anchors measured output connections on the left edge and hit-tests their outer half', () => {
    const graph = createTestSubgraph()
    graph.addOutput('result', 'IMAGE')
    const node = graph.outputNode
    node.pos = [100, 200]
    node.size = [128, 100]
    useSubgraphIoLayoutStore().report(node, {
      offsetX: 0,
      width: 180,
      height: 90,
      slotCenters: [30, 66]
    })

    node.arrange()

    expect([...node.boundingRect]).toEqual([100, 200, 180, 90])
    expect(node.allSlots.map((slot) => [...slot.pos])).toEqual([
      [100, 230],
      [100, 266]
    ])
    expect(graph.getIoNodeOnPos(95, 230)).toBe(node)
    expect(graph.getIoNodeOnPos(95, 248)).toBeUndefined()
  })

  it('isolates measurements by definition and restores the canvas layout on unmount', () => {
    const first = createTestSubgraph()
    const second = createTestSubgraph()
    const layouts = useSubgraphIoLayoutStore()
    layouts.report(first.inputNode, {
      offsetX: 0,
      width: 320,
      height: 400,
      slotCenters: []
    })
    first.inputNode.arrange()
    second.inputNode.arrange()

    expect(first.inputNode.boundingRect[3]).toBe(400)
    expect(second.inputNode.boundingRect[3]).not.toBe(400)
    layouts.clear(first.inputNode)
    first.inputNode.arrange()

    expect(first.inputNode.boundingRect[3]).not.toBe(400)
  })

  it('re-measures slot centers when the panel rows are reordered', async () => {
    const graph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'INT' },
        { name: 'b', type: 'INT' }
      ]
    })
    const panel = document.createElement('div')
    Object.defineProperty(panel, 'offsetHeight', { value: 100 })
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100)
    const rows = [10, 40].map((top) => {
      const row = panel.appendChild(document.createElement('div'))
      row.dataset.subgraphPort = ''
      row.getBoundingClientRect = () => new DOMRect(0, top, 10, 10)
      return row
    })
    const slots = shallowRef(graph.inputNode.allSlots)
    const scope = effectScope()
    scope.run(() =>
      useSubgraphIoLayout(
        () => graph.inputNode,
        computed(() => panel),
        () => slots.value
      )
    )
    await nextTick()
    expect(graph.inputNode.measured?.slotCenters).toEqual([15, 45])

    panel.prepend(rows[1])
    slots.value = [...slots.value]
    await nextTick()

    expect(graph.inputNode.measured?.slotCenters).toEqual([45, 15])
    scope.stop()
  })
})

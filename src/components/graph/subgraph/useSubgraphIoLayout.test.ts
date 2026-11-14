import { describe, expect, it } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'

import { useSubgraphIoLayout } from '@/components/graph/subgraph/useSubgraphIoLayout'
import { resolvePointerTarget } from '@/lib/litegraph/src/canvas/resolvePointerTarget'
import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

function reportPanel(
  node: SubgraphInputNode | SubgraphOutputNode,
  width: number,
  height: number,
  slotCenters: number[] = []
) {
  layoutStore.reportContentSize(node.subgraph.id, node.id, { width, height })
  layoutStore.updateNodeSlotOffsets(
    node.subgraph.id,
    node.id,
    slotCenters.map((y, index) => ({
      index,
      type: node.slotDirection,
      position: { x: 0, y }
    })),
    'expanded'
  )
}

describe('subgraph IO renderer measurements', () => {
  it('targets the visible IO surface ahead of an interior node behind it', () => {
    stubCanvasGetContext()
    const graph = createTestSubgraph()
    graph.inputNode.pos = [100, 200]
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
      kind: 'node',
      node: interior
    })
    reportPanel(graph.inputNode, 320, 400)
    graph.inputNode.arrange()
    expect(resolvePointerTarget(canvas, graph, event, interior)).toEqual({
      kind: 'subgraphIO',
      ioNode: graph.inputNode
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
    reportPanel(node, 320, 400, [40, 72, 140])

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
    reportPanel(node, 180, 90, [30, 66])

    node.arrange()

    expect([...node.boundingRect]).toEqual([100, 200, 180, 90])
    expect(node.allSlots.map((slot) => [...slot.pos])).toEqual([
      [100, 230],
      [100, 266]
    ])
    expect(graph.getIoNodeOnPos(95, 230)).toBe(node)
    expect(graph.getIoNodeOnPos(95, 248)).toBeUndefined()
  })

  it('keeps each subgraph definition measurement to its own IO node', () => {
    const first = createTestSubgraph()
    const second = createTestSubgraph()
    reportPanel(first.inputNode, 320, 400)
    first.inputNode.arrange()
    second.inputNode.arrange()

    expect(first.inputNode.boundingRect[3]).toBe(400)
    expect(second.inputNode.boundingRect[3]).not.toBe(400)
  })

  it('places the panel over its IO node on each canvas frame', async () => {
    stubCanvasGetContext()
    const graph = createTestSubgraph()
    const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
      skip_render: true,
      skip_events: true
    })
    useCanvasStore().canvas = canvas
    const panel = document.createElement('div')
    const scope = effectScope()
    scope.run(() =>
      useSubgraphIoLayout(
        () => graph.inputNode,
        computed(() => panel),
        () => graph.inputNode.allSlots
      )
    )
    await nextTick()
    graph.inputNode.pos = [100, 200]
    canvas.ds.offset = [10, -20]
    canvas.ds.scale = 2

    canvas.draw(true, true)

    expect(panel.style.transform).toBe('translate(220px, 360px) scale(2)')
    scope.stop()
  })

  it('moves slot anchors as soon as the panel reports reordered rows', async () => {
    const graph = createTestSubgraph({
      inputs: [
        { name: 'a', type: 'INT' },
        { name: 'b', type: 'INT' }
      ]
    })
    graph.inputNode.pos = [0, 0]
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
    expect(graph.inputNode.slots.map((slot) => slot.pos[1])).toEqual([15, 45])

    panel.prepend(rows[1])
    slots.value = [...slots.value]
    await nextTick()

    expect(graph.inputNode.slots.map((slot) => slot.pos[1])).toEqual([45, 15])
    scope.stop()
  })
})

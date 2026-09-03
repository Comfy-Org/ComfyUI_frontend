import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { getNodeInputOnPos } from '@/lib/litegraph/src/canvas/measureSlots'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toGroupId } from '@/types/groupId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

const NODE_AT = { x: 120, y: 420 }
const NODE_SIZE = { width: 140, height: 60 }
const GROUP_AT = { x: 100, y: 360 }
const DRAG = { x: 100, y: 100 }
const REROUTE_AT = { x: 500, y: 300 }

function buildGraph() {
  const graph = new LGraph()

  const node = new LGraphNode('Member')
  node.addInput('in', 'number')
  node.pos = [NODE_AT.x, NODE_AT.y]
  node.size = [NODE_SIZE.width, NODE_SIZE.height]
  graph.add(node)
  node.updateArea()

  const producer = new LGraphNode('Producer')
  producer.addOutput('out', 'number')
  producer.pos = [800, 420]
  producer.size = [NODE_SIZE.width, NODE_SIZE.height]
  graph.add(producer)
  producer.updateArea()

  const group = new LGraphGroup('Group', toGroupId(1))
  group.pos = [GROUP_AT.x, GROUP_AT.y]
  group.size = [220, 220]
  graph.add(group)
  group.recomputeInsideNodes()

  return { graph, node, producer, group }
}

function createCanvas(graph: LGraph): LGraphCanvas {
  const element = document.createElement('canvas')
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  return new LGraphCanvas(element, graph, {
    skip_events: true,
    skip_render: true
  })
}

function dragGroup(canvas: LGraphCanvas, group: LGraphGroup) {
  canvas.selectedItems.add(group)
  canvas.isDragging = true
  canvas.last_mouse = [0, 0]
  canvas.processMouseMove(
    new PointerEvent('pointermove', {
      buttons: 1,
      clientX: DRAG.x,
      clientY: DRAG.y,
      isPrimary: true
    })
  )
}

/**
 * The layout store and the litegraph instance are two writable paths to a
 * node's geometry. A hit target read through either must land in the same
 * place.
 */
function expectAuthoritiesAgree(graph: LGraph, node: LGraphNode) {
  expect(
    layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.bounds
  ).toEqual({
    x: node.pos[0],
    y: node.pos[1],
    width: node.size[0],
    height: node.size[1]
  })
  expect(graph.getNodeOnPos(node.pos[0] + 5, node.pos[1] + 5)).toBe(node)
}

describe('hit targets across renderer modes and state reloads (I2)', () => {
  afterEach(() => {
    LiteGraph.vueNodesMode = false
    layoutStore.resetForTests()
  })

  it('drags member node and slot hit targets along with the group in the legacy renderer', () => {
    const { graph, node, group } = buildGraph()
    const canvas = createCanvas(graph)
    expect(group._children.has(node)).toBe(true)

    dragGroup(canvas, group)
    node.updateArea()

    const moved = { x: NODE_AT.x + DRAG.x, y: NODE_AT.y + DRAG.y }
    expect(graph.getNodeOnPos(moved.x + 5, moved.y + 5)).toBe(node)
    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBeNull()
    expect(getNodeInputOnPos(node, moved.x + 10, moved.y + 10)?.index).toBe(0)
    expect(
      getNodeInputOnPos(node, NODE_AT.x + 10, NODE_AT.y + 10)
    ).toBeUndefined()
  })

  it('moves member node hit targets with the group in Vue nodes mode', () => {
    LiteGraph.vueNodesMode = true
    const { graph, node, group } = buildGraph()
    const canvas = createCanvas(graph)
    expect(group._children.has(node)).toBe(true)

    dragGroup(canvas, group)
    node.updateArea()

    expect([...group.pos]).toEqual([GROUP_AT.x + DRAG.x, GROUP_AT.y + DRAG.y])
    expect(
      graph.getNodeOnPos(NODE_AT.x + DRAG.x + 5, NODE_AT.y + DRAG.y + 5)
    ).toBe(node)
    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBeNull()
    expectAuthoritiesAgree(graph, node)
  })

  it('restores node and reroute hit targets in both authorities after a state reload', () => {
    LiteGraph.vueNodesMode = true
    const { graph, node, producer } = buildGraph()
    const link = producer.connect(0, node, 0)
    if (!link) throw new Error('expected a link')
    const reroute = graph.createReroute([REROUTE_AT.x, REROUTE_AT.y], link)
    if (!reroute) throw new Error('expected a reroute')
    const beforeEdit = graph.serialize()

    node.setPos(900, 900)
    reroute.move(0, 400)
    node.updateArea()

    expect(graph.getNodeOnPos(905, 905)).toBe(node)
    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBeNull()
    expect(
      graph.getRerouteOnPos(
        REROUTE_AT.x,
        REROUTE_AT.y + 400,
        graph.reroutes.values()
      )
    ).toBeDefined()

    LiteGraph.vueNodesMode = false
    graph.configure(beforeEdit)
    const restored = graph.getNodeById(node.id)
    if (!restored) throw new Error('node is missing after state reload')
    restored.updateArea()

    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBe(restored)
    expect(graph.getNodeOnPos(905, 905)).toBeNull()
    expectAuthoritiesAgree(graph, restored)
    expect(
      graph.getRerouteOnPos(REROUTE_AT.x, REROUTE_AT.y, graph.reroutes.values())
    ).toBeDefined()
    expect(
      graph.getRerouteOnPos(
        REROUTE_AT.x,
        REROUTE_AT.y + 400,
        graph.reroutes.values()
      )
    ).toBeUndefined()
  })
})

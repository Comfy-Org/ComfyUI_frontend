import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { getNodeInputOnPos } from '@/lib/litegraph/src/canvas/measureSlots'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

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

  const group = new LGraphGroup('Group', 1)
  group.pos = [GROUP_AT.x, GROUP_AT.y]
  group.size = [220, 220]
  graph.add(group)
  group.recomputeInsideNodes()

  return { graph, node, producer, group }
}

function seedLayoutStore(graph: LGraph) {
  layoutStore.initializeFromLiteGraph(
    graph.nodes.map((node) => ({
      id: node.id,
      pos: [node.pos[0], node.pos[1]] as [number, number],
      size: [node.size[0], node.size[1]] as [number, number]
    }))
  )
}

/**
 * The layout store and the litegraph instance are two writable paths to a
 * node's geometry. A hit target read through either must land in the same
 * place.
 */
function expectAuthoritiesAgree(graph: LGraph, node: LGraphNode) {
  expect(layoutStore.getNodeLayoutRef(node.id).value?.bounds).toEqual({
    x: node.pos[0],
    y: node.pos[1],
    width: node.size[0],
    height: node.size[1]
  })
  expect(graph.getNodeOnPos(node.pos[0] + 5, node.pos[1] + 5)).toBe(node)
}

describe('hit targets across renderer modes and history (I2)', () => {
  afterEach(() => {
    LiteGraph.vueNodesMode = false
    layoutStore.initializeFromLiteGraph([])
  })

  it('drags member node and slot hit targets along with the group in the legacy renderer', () => {
    const { graph, node, group } = buildGraph()
    expect(group._children.has(node)).toBe(true)

    group.move(DRAG.x, DRAG.y)
    node.updateArea()

    const moved = { x: NODE_AT.x + DRAG.x, y: NODE_AT.y + DRAG.y }
    expect(graph.getNodeOnPos(moved.x + 5, moved.y + 5)).toBe(node)
    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBeNull()
    expect(getNodeInputOnPos(node, moved.x + 10, moved.y + 10)?.index).toBe(0)
    expect(
      getNodeInputOnPos(node, NODE_AT.x + 10, NODE_AT.y + 10)
    ).toBeUndefined()
  })

  // Asserts the behaviour we want, so it fails today and passes the moment
  // #15566 is fixed. Written as `.fails` rather than pinning the current wrong
  // answer, because a test that encodes a defect goes red when someone repairs
  // the defect, and the tempting move at that point is to edit the test.
  it.fails('moves member node hit targets with the group in Vue nodes mode (#15566)', () => {
    LiteGraph.vueNodesMode = true
    const { graph, node, group } = buildGraph()
    seedLayoutStore(graph)
    expect(group._children.has(node)).toBe(true)

    group.move(DRAG.x, DRAG.y)
    node.updateArea()

    expect([...group.pos]).toEqual([GROUP_AT.x + DRAG.x, GROUP_AT.y + DRAG.y])
    expect(
      graph.getNodeOnPos(NODE_AT.x + DRAG.x + 5, NODE_AT.y + DRAG.y + 5)
    ).toBe(node)
    expect(graph.getNodeOnPos(NODE_AT.x + 5, NODE_AT.y + 5)).toBeNull()
    expectAuthoritiesAgree(graph, node)
  })

  it('restores node and reroute hit targets in both authorities after an undo in legacy mode', () => {
    LiteGraph.vueNodesMode = true
    const { graph, node, producer } = buildGraph()
    seedLayoutStore(graph)
    const link = producer.connect(0, node, 0)
    if (!link) throw new Error('expected a link')
    const reroute = graph.createReroute([REROUTE_AT.x, REROUTE_AT.y], link)
    if (!reroute) throw new Error('expected a reroute')
    const beforeEdit = graph.serialize()

    const mutations = useLayoutMutations()
    mutations.setSource(LayoutSource.Vue)
    mutations.moveNode(node.id, { x: 900, y: 900 })
    reroute.pos = [REROUTE_AT.x, REROUTE_AT.y + 400]

    LiteGraph.vueNodesMode = false
    graph.configure(beforeEdit)
    const restored = graph.getNodeById(node.id)
    if (!restored) throw new Error('node is missing after undo')
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

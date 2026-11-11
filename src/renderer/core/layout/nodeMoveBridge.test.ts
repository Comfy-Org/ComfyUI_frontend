import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createComfyApi } from '@/platform/nodeApi/comfyApi'
import { resetNodeMoveSource } from '@/platform/nodeApi/interaction'
import type { NodeMoveEvent } from '@/platform/nodeApi/interaction'
import type { NodeHandle } from '@/platform/nodeApi/nodeHandle'

import { installNodeMoveBridge } from './nodeMoveBridge'
import { layoutStore } from './store/layoutStore'
import { useLayoutMutations } from './operations/layoutMutations'
import { LayoutSource } from './types'

function graphIds(nodes: readonly NodeHandle[]): string[] {
  return nodes.map(({ graphId }) => {
    assert.isDefined(graphId)
    return graphId
  })
}

describe('node movement reaches the published API', () => {
  let graph: LGraph
  let node: LGraphNode
  let comfy: ReturnType<typeof createComfyApi>
  let mutations: ReturnType<typeof useLayoutMutations>
  let seen: NodeMoveEvent[]
  const stops: (() => void)[] = []

  function observe() {
    stops.push(comfy.onNodeMoved((event) => seen.push(event)))
  }

  beforeEach(() => {
    resetNodeMoveSource()
    installNodeMoveBridge()

    graph = new LGraph()
    node = new LGraphNode('Mover', 'Mover')
    graph.add(node)
    comfy = createComfyApi(() => graph)
    mutations = useLayoutMutations(LayoutSource.Canvas)
    const position = { x: 0, y: 0 }
    const size = { width: 100, height: 60 }
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: graph.id,
      nodeId: node.id,
      layout: {
        id: node.id,
        position,
        size,
        bounds: { ...position, ...size },
        zIndex: layoutStore.allocateZIndex(),
        visible: true
      },
      source: LayoutSource.Canvas,
      timestamp: Date.now()
    })
    seen = []
  })

  afterEach(() => {
    for (const stop of stops.splice(0)) stop()
    layoutStore.isDraggingVueNodes.value = false
  })

  it('reports a move made the way the canvas makes one', async () => {
    observe()

    node.pos = [120, 240]
    await nextTick()

    expect(seen.map((e) => e.position)).toEqual([{ x: 120, y: 240 }])
  })

  it('reports a move made the way Nodes 2.0 makes one', async () => {
    observe()

    mutations.moveNode(graph.id, node.id, { x: 33, y: 44 })
    await nextTick()

    expect(seen.map((e) => e.position)).toEqual([{ x: 33, y: 44 }])
  })

  it.for(['canvas', 'vue'] as const)(
    'does not deliver a queued %s move to a replacement workflow',
    async (renderer) => {
      observe()
      if (renderer === 'canvas') node.pos = [120, 240]
      else mutations.moveNode(graph.id, node.id, { x: 120, y: 240 })

      graph = new LGraph()
      const replacement = new LGraphNode('Replacement', 'Mover')
      graph.add(replacement)
      expect(replacement.id).toBe(node.id)
      await nextTick()

      expect(seen).toEqual([])

      replacement.pos = [30, 40]
      await nextTick()

      expect(seen).toEqual([
        {
          node: expect.objectContaining({
            id: String(replacement.id),
            graphId: graph.id
          }),
          position: { x: 30, y: 40 }
        }
      ])
    }
  )

  it('delivers movement from a subgraph that is not visible', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph, name: 'Hidden' })
    graph.subgraphs.set(subgraph.id, subgraph)
    const inner = new LGraphNode('Inner', 'Mover')
    subgraph.add(inner)
    observe()

    mutations.moveNode(graph.id, inner.id, { x: 50, y: 60 })
    await nextTick()

    expect(seen).toEqual([
      {
        node: expect.objectContaining({
          id: String(inner.id),
          graphId: subgraph.id
        }),
        position: { x: 50, y: 60 }
      }
    ])
  })

  it('does not deliver a completed drag to a replacement workflow', async () => {
    const drags: string[][] = []
    stops.push(comfy.onNodeDragEnd((nodes) => drags.push(graphIds(nodes))))
    layoutStore.isDraggingVueNodes.value = true
    mutations.moveNode(graph.id, node.id, { x: 10, y: 10 })
    await nextTick()

    graph = new LGraph()
    const replacement = new LGraphNode('Replacement', 'Mover')
    graph.add(replacement)
    expect(replacement.id).toBe(node.id)
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(drags).toEqual([])

    layoutStore.isDraggingVueNodes.value = true
    mutations.moveNode(graph.id, replacement.id, { x: 20, y: 20 })
    await nextTick()
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(drags).toEqual([[graph.id]])
  })

  it('keeps same-ID drag movements separate across workflows', async () => {
    const original = graph
    const drags: string[][] = []
    stops.push(comfy.onNodeDragEnd((nodes) => drags.push(graphIds(nodes))))
    layoutStore.isDraggingVueNodes.value = true
    mutations.moveNode(graph.id, node.id, { x: 10, y: 10 })
    await nextTick()

    graph = new LGraph()
    const replacement = new LGraphNode('Replacement', 'Mover')
    graph.add(replacement)
    expect(replacement.id).toBe(node.id)
    mutations.moveNode(graph.id, replacement.id, { x: 20, y: 20 })
    await nextTick()

    graph = original
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(drags).toEqual([[original.id]])
  })

  it('reports every node a drag moved, once, on release', async () => {
    const drags: string[][] = []
    stops.push(
      comfy.onNodeDragEnd((nodes) => drags.push(nodes.map((n) => n.id)))
    )

    layoutStore.isDraggingVueNodes.value = true
    mutations.moveNode(graph.id, node.id, { x: 10, y: 10 })
    mutations.moveNode(graph.id, node.id, { x: 20, y: 20 })
    await nextTick()
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(drags).toEqual([[String(node.id)]])
  })

  it('does not report a move made outside a drag', async () => {
    const drags: unknown[] = []
    stops.push(comfy.onNodeDragEnd((nodes) => drags.push(nodes)))

    mutations.moveNode(graph.id, node.id, { x: 10, y: 10 })
    await nextTick()
    layoutStore.isDraggingVueNodes.value = true
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(drags).toEqual([])
  })

  it('reports a move made as part of a batch', async () => {
    observe()

    layoutStore.applyOperation({
      type: 'batchUpdateBounds',
      graphId: graph.id,
      nodeIds: [node.id],
      bounds: { [node.id]: { x: 55, y: 66, width: 100, height: 80 } },
      source: LayoutSource.Canvas,
      timestamp: Date.now()
    })
    await nextTick()

    expect(seen.map((e) => e.position)).toEqual([{ x: 55, y: 66 }])
  })

  it('ignores layout changes that are not moves', async () => {
    observe()

    layoutStore.applyOperation({
      type: 'resizeNode',
      graphId: graph.id,
      nodeId: node.id,
      size: { width: 400, height: 300 },
      source: LayoutSource.Canvas,
      timestamp: Date.now()
    })
    await nextTick()

    expect(seen).toEqual([])
  })
})

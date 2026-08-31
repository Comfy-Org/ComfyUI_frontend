/**
 * The wiring, not the shape.
 *
 * `interaction.test.ts` proves a host's movement reaches a pack. This proves
 * there *is* a host — that a real node move, through either renderer's path,
 * arrives at the published API. Three capabilities shipped this week that were
 * tested in isolation and never connected; this is the half that catches that.
 */
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createNodeDragEndObserver,
  createNodeMoveObserver,
  resetNodeMoveSource
} from '@/platform/nodeApi/interaction'
import type { NodeMoveEvent } from '@/platform/nodeApi/interaction'
import { createUuidv4 } from '@/utils/uuid'

import { installNodeMoveBridge } from './nodeMoveBridge'
import { layoutStore } from './store/layoutStore'
import { useLayoutMutations } from './operations/layoutMutations'
import { LayoutSource } from './types'

/** The global listener fan-out is queued, not synchronous. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const GRAPH = createUuidv4()

describe('node movement reaches the published API', () => {
  let graph: LGraph
  let node: LGraphNode
  let mutations: ReturnType<typeof useLayoutMutations>
  let seen: NodeMoveEvent[]
  // The layout store is a module singleton, so a listener left behind pushes
  // into the next test's array.
  const stops: (() => void)[] = []

  function observe() {
    const onNodeMoved = createNodeMoveObserver(
      (id) => ({ id, isDeleted: false }) as never
    )
    stops.push(onNodeMoved((event) => seen.push(event)))
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    resetNodeMoveSource()
    installNodeMoveBridge()

    graph = new LGraph()
    node = new LGraphNode('Mover', 'Mover')
    graph.add(node)
    mutations = useLayoutMutations(LayoutSource.Canvas)
    // `moveNode` early-returns unless the node already has a layout entry,
    // which the app creates as the node enters the graph.
    const position = { x: 0, y: 0 }
    const size = { width: 100, height: 60 }
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: GRAPH,
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
  })

  it('reports a move made the way the canvas makes one', async () => {
    observe()

    node.pos = [120, 240]
    await settle()

    expect(seen.map((e) => e.position)).toEqual([{ x: 120, y: 240 }])
  })

  it('reports a move made the way Nodes 2.0 makes one', async () => {
    // Nodes 2.0 goes through the mutation directly rather than `LGraphNode.pos`,
    // and covering only the canvas path would miss half the contract.
    observe()

    mutations.moveNode(GRAPH, node.id, { x: 33, y: 44 })
    await settle()

    expect(seen.map((e) => e.position)).toEqual([{ x: 33, y: 44 }])
  })

  it('reports every node a drag moved, once, on release', async () => {
    // The release is where an editing gesture commits — swap, insert-on-link.
    const drags: string[][] = []
    const onDragEnd = createNodeDragEndObserver(
      (id) => ({ id, isDeleted: false }) as never
    )
    stops.push(onDragEnd((nodes) => drags.push(nodes.map((n) => n.id))))

    layoutStore.isDraggingVueNodes.value = true
    mutations.moveNode(GRAPH, node.id, { x: 10, y: 10 })
    mutations.moveNode(GRAPH, node.id, { x: 20, y: 20 })
    await settle()
    layoutStore.isDraggingVueNodes.value = false
    await settle()

    expect(drags).toEqual([[String(node.id)]])
  })

  it('does not report a move made outside a drag', async () => {
    const drags: unknown[] = []
    const onDragEnd = createNodeDragEndObserver(
      (id) => ({ id, isDeleted: false }) as never
    )
    stops.push(onDragEnd((nodes) => drags.push(nodes)))

    mutations.moveNode(GRAPH, node.id, { x: 10, y: 10 })
    await settle()
    layoutStore.isDraggingVueNodes.value = true
    layoutStore.isDraggingVueNodes.value = false
    await settle()

    expect(drags).toEqual([])
  })

  it('ignores layout changes that are not moves', async () => {
    observe()

    layoutStore.applyOperation({
      type: 'resizeNode',
      graphId: GRAPH,
      nodeId: node.id,
      size: { width: 400, height: 300 },
      source: LayoutSource.Canvas,
      timestamp: Date.now()
    })
    await settle()

    expect(seen).toEqual([])
  })
})

describe('boot ordering', () => {
  // A source-order check rather than a behavioural one, because what broke is
  // a boot sequence: the bridge was installed in addApiUpdateHandlers(), four
  // lines after loadExtensions(), so every pack that subscribed to
  // onNodeMoved at module scope threw "the host has not provided a source".
  // Three kjnodes gesture files did, and no unit test could see it.
  it('installs the bridge before extensions load', () => {
    const setup = readFileSync('src/scripts/app.ts', 'utf8')
    const bridge = setup.indexOf('installNodeMoveBridge()')
    const extensions = setup.indexOf('loadExtensions()')

    expect(bridge).toBeGreaterThan(-1)
    expect(extensions).toBeGreaterThan(-1)
    expect(bridge).toBeLessThan(extensions)
  })
})

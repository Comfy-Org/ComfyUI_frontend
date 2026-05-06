import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeLayout } from '@/renderer/core/layout/types'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

const TEST_NODE_TYPE = 'test/CloneZIndex' as const

class TestNode extends LGraphNode {
  static override type = TEST_NODE_TYPE

  constructor(title?: string) {
    super(title ?? TEST_NODE_TYPE)
    this.type = TEST_NODE_TYPE
  }
}

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    getTransform: vi
      .fn()
      .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } satisfies Partial<CanvasRenderingContext2D>

  el.getContext = vi
    .fn()
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  return new LGraphCanvas(el, graph, { skip_render: true })
}

function createLayoutEntry(node: LGraphNode, zIndex: number) {
  const nodeId = String(node.id)
  const layout: NodeLayout = {
    id: nodeId,
    position: { x: node.pos[0], y: node.pos[1] },
    size: { width: node.size[0], height: node.size[1] },
    zIndex,
    visible: true,
    bounds: {
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1]
    }
  }
  layoutStore.applyOperation({
    type: 'createNode',
    entity: 'node',
    nodeId,
    layout,
    timestamp: Date.now(),
    source: LayoutSource.Canvas,
    actor: 'test'
  })
}

function setZIndex(nodeId: string, zIndex: number, previousZIndex: number) {
  layoutStore.applyOperation({
    type: 'setNodeZIndex',
    entity: 'node',
    nodeId,
    zIndex,
    previousZIndex,
    timestamp: Date.now(),
    source: LayoutSource.Canvas,
    actor: 'test'
  })
}

describe('cloned node z-index in Vue renderer', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let previousVueNodesMode: boolean

  beforeEach(() => {
    vi.clearAllMocks()
    previousVueNodesMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = true
    LiteGraph.registerNodeType(TEST_NODE_TYPE, TestNode)

    graph = new LGraph()
    canvas = createCanvas(graph)
    LGraphCanvas.active_canvas = canvas

    layoutStore.initializeFromLiteGraph([])

    // Simulate Vue runtime: create layout entries when nodes are added
    graph.onNodeAdded = (node: LGraphNode) => {
      createLayoutEntry(node, 0)
    }
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = previousVueNodesMode
  })

  it('places cloned nodes above the original node z-index', () => {
    const originalNode = new TestNode()
    originalNode.pos = [100, 100]
    originalNode.size = [200, 100]
    graph.add(originalNode)

    const originalNodeId = String(originalNode.id)

    setZIndex(originalNodeId, 5, 0)

    const originalLayout = layoutStore.getNodeLayoutRef(originalNodeId).value
    expect(originalLayout?.zIndex).toBe(5)

    // Clone the node via cloneNodes (same path as right-click > clone)
    const result = LGraphCanvas.cloneNodes([originalNode])
    expect(result).toBeDefined()
    expect(result!.created.length).toBe(1)

    const clonedNode = result!.created[0] as LGraphNode
    const clonedNodeId = String(clonedNode.id)

    // The cloned node should have a z-index higher than the original
    const clonedLayout = layoutStore.getNodeLayoutRef(clonedNodeId).value
    expect(clonedLayout).toBeDefined()
    expect(clonedLayout!.zIndex).toBeGreaterThan(originalLayout!.zIndex)
  })

  it('assigns distinct sequential z-indices when cloning multiple nodes', () => {
    const nodeA = new TestNode()
    nodeA.pos = [100, 100]
    nodeA.size = [200, 100]
    graph.add(nodeA)
    setZIndex(String(nodeA.id), 3, 0)

    const nodeB = new TestNode()
    nodeB.pos = [400, 100]
    nodeB.size = [200, 100]
    graph.add(nodeB)
    setZIndex(String(nodeB.id), 7, 0)

    const result = LGraphCanvas.cloneNodes([nodeA, nodeB])
    expect(result).toBeDefined()
    expect(result!.created.length).toBe(2)

    const clonedA = result!.created[0] as LGraphNode
    const clonedB = result!.created[1] as LGraphNode
    const layoutA = layoutStore.getNodeLayoutRef(String(clonedA.id)).value!
    const layoutB = layoutStore.getNodeLayoutRef(String(clonedB.id)).value!

    // Both cloned nodes should be above the highest original (z-index 7)
    expect(layoutA.zIndex).toBeGreaterThan(7)
    expect(layoutB.zIndex).toBeGreaterThan(7)

    // Each cloned node should have a distinct z-index
    expect(layoutA.zIndex).not.toBe(layoutB.zIndex)
  })
})

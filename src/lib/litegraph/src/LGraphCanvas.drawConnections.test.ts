import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    batchUpdateNodeBounds: vi.fn(),
    getCurrentSource: vi.fn(() => 'test'),
    getCurrentActor: vi.fn(() => 'test'),
    applyOperation: vi.fn(),
    pendingSlotSync: false
  }
}))

function createMockCtx(): CanvasRenderingContext2D {
  return createMockCanvas2DContext({
    translate: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    roundRect: vi.fn(),
    getTransform: vi
      .fn()
      .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn()
    }),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    isPointInStroke: vi.fn().mockReturnValue(false),
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true
  })
}

/**
 * Creates a link between two nodes by directly mutating graph state,
 * bypassing the layout store integration in connect().
 */
function createTestLink(
  graph: LGraph,
  sourceNode: LGraphNode,
  outputSlot: number,
  targetNode: LGraphNode,
  inputSlot: number
): LLink {
  const linkId = toLinkId(Number(graph.state.lastLinkId) + 1)
  graph.state.lastLinkId = linkId
  const link = new LLink(
    linkId,
    sourceNode.outputs[outputSlot].type,
    sourceNode.id,
    outputSlot,
    targetNode.id,
    inputSlot
  )
  graph._addLink(link)
  return link
}

describe('drawConnections', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))

    canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600
    canvasElement.getContext = vi.fn().mockReturnValue(createMockCtx())
    canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600
    })

    graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true
    })

    LiteGraph.vueNodesMode = false
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('arranges widget-input slots before rendering links', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [0, 100]
    sourceNode.size = [150, 60]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const targetNode = new LGraphNode('Target')
    targetNode.pos = [300, 100]
    targetNode.size = [200, 120]
    const widget = targetNode.addWidget('text', 'value', '', null)
    const input = targetNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    graph.add(targetNode)

    createTestLink(graph, sourceNode, 0, targetNode, 0)

    // Before drawConnections, input.pos should not be set
    expect(input.pos).toBeUndefined()

    canvas.drawConnections(createMockCtx())

    // After drawConnections, input.pos should be set to the widget row
    expect(input.pos).toBeDefined()
    expect(input.pos![1]).toBeGreaterThan(0)

    const offset = LiteGraph.NODE_SLOT_HEIGHT * 0.5
    expect(input.pos![1]).toBe(widget.y + offset)
  })

  it('does not re-arrange nodes whose widget-input slots already have positions', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [0, 100]
    sourceNode.size = [150, 60]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const targetNode = new LGraphNode('Target')
    targetNode.pos = [300, 100]
    targetNode.size = [200, 120]
    targetNode.addWidget('text', 'value', '', null)
    const input = targetNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    graph.add(targetNode)

    createTestLink(graph, sourceNode, 0, targetNode, 0)

    // Pre-arrange so input.pos is already set
    targetNode._setConcreteSlots()
    targetNode.arrange()
    expect(input.pos).toBeDefined()

    const arrangeSpy = vi.spyOn(targetNode, 'arrange')

    canvas.drawConnections(createMockCtx())

    expect(arrangeSpy).not.toHaveBeenCalled()
  })

  it('never reads the deprecated slot link mirrors in a connect-draw-serialize cycle', () => {
    const deprecationCallback = vi.fn()
    const originalCallbacks = LiteGraph.onDeprecationWarning
    LiteGraph.onDeprecationWarning = [deprecationCallback]
    LiteGraph.alwaysRepeatWarnings = true
    try {
      const sourceNode = new LGraphNode('Source')
      sourceNode.addOutput('out', 'STRING')
      graph.add(sourceNode)

      const targetNode = new LGraphNode('Target')
      targetNode.addInput('in', 'STRING')
      graph.add(targetNode)

      sourceNode.connect(0, targetNode, 0)
      canvas.drawConnections(createMockCtx())
      graph.asSerialisable()

      expect(deprecationCallback).not.toHaveBeenCalled()
    } finally {
      LiteGraph.onDeprecationWarning = originalCallbacks
      LiteGraph.alwaysRepeatWarnings = false
    }
  })

  it('renders links in target order instead of generated id order', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [100, 100]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const firstTarget = new LGraphNode('First target')
    firstTarget.pos = [300, 100]
    firstTarget.addInput('in', 'STRING')
    graph.add(firstTarget)

    const secondTarget = new LGraphNode('Second target')
    secondTarget.pos = [300, 200]
    secondTarget.addInput('in', 'STRING')
    graph.add(secondTarget)

    const secondLink = createTestLink(graph, sourceNode, 0, secondTarget, 0)
    const firstLink = createTestLink(graph, sourceNode, 0, firstTarget, 0)
    canvas.visible_area[2] = 800
    canvas.visible_area[3] = 600
    vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})

    canvas.drawConnections(createMockCtx())

    expect([...canvas.renderedPaths]).toEqual([firstLink, secondLink])
  })
  it('positions widget-input slots when display name differs from slot.widget.name', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [0, 100]
    sourceNode.size = [150, 60]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const targetNode = new LGraphNode('Target')
    targetNode.pos = [300, 100]
    targetNode.size = [200, 120]

    // Widget has a display name that differs from the slot's widget.name
    // (simulates a renamed subgraph label)
    const widget = targetNode.addWidget('text', 'renamed_label', '', null)
    const input = targetNode.addInput('renamed_label', 'STRING')
    input.widget = { name: 'original_name' }

    // Bind the widget as the slot's _widget (preferred over name-map lookup)
    input._widget = widget

    graph.add(targetNode)
    createTestLink(graph, sourceNode, 0, targetNode, 0)

    canvas.drawConnections(createMockCtx())

    expect(input.pos).toBeDefined()
    const offset = LiteGraph.NODE_SLOT_HEIGHT * 0.5
    expect(input.pos![1]).toBe(widget.y + offset)
  })
})

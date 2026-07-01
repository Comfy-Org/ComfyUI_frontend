import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  queryLinkBadgeAtPoint,
  setRevealedLinks
} from '@/lib/litegraph/src/canvas/linkBadges'
import { LLink } from '@/lib/litegraph/src/LLink'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
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
  const linkId = ++graph.state.lastLinkId
  const link = new LLink(
    linkId,
    sourceNode.outputs[outputSlot].type,
    sourceNode.id,
    outputSlot,
    targetNode.id,
    inputSlot
  )
  graph._links.set(linkId, link)
  sourceNode.outputs[outputSlot].links ??= []
  sourceNode.outputs[outputSlot].links!.push(linkId)
  targetNode.inputs[inputSlot].link = linkId
  return link
}

describe('drawConnections widget-input slot positioning', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia())

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

  it('draws hidden links as end badges instead of a curve', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [0, 100]
    sourceNode.size = [150, 60]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const targetNode = new LGraphNode('Target')
    targetNode.pos = [300, 100]
    targetNode.size = [150, 60]
    targetNode.addInput('in', 'STRING')
    graph.add(targetNode)

    const link = createTestLink(graph, sourceNode, 0, targetNode, 0)
    link.hidden = true

    // Hidden, not revealed: a revealed link would fall through to the curve.
    setRevealedLinks([])
    // Viewport must cover the nodes so the link passes the on-screen cull.
    canvas.visible_area.set([0, 0, 800, 600])
    canvas.drawConnections(createMockCtx())

    // The badge branch returns before the link is recorded as a drawn curve...
    expect(canvas.renderedPaths.has(link)).toBe(false)
    // ...and registers a badge hit area at the output socket instead.
    const [outputX, outputY] = sourceNode.getOutputPos(0)
    expect(queryLinkBadgeAtPoint(outputX + 20, outputY)).toBe(link.id)
  })
})

describe('showLinkMenu link visibility actions', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  const originalContextMenu = LiteGraph.ContextMenu

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia())

    const canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600
    canvasElement.getContext = vi.fn().mockReturnValue(createMockCtx())
    canvasElement.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })

    graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
    LiteGraph.vueNodesMode = false
  })

  afterEach(() => {
    LiteGraph.ContextMenu = originalContextMenu
    LiteGraph.vueNodesMode = false
  })

  function linkBetweenNodes(): LLink {
    const source = new LGraphNode('Source')
    source.addOutput('out', 'STRING')
    graph.add(source)
    const target = new LGraphNode('Target')
    target.addInput('in', 'STRING')
    graph.add(target)
    return createTestLink(graph, source, 0, target, 0)
  }

  function clickMenuItem(link: LLink, item: string): void {
    let callback: ((v: string, o: unknown, e: MouseEvent) => void) | undefined
    LiteGraph.ContextMenu = vi
      .fn<typeof LiteGraph.ContextMenu>()
      .mockImplementation(function (_values, options) {
        callback = options.callback
      }) as Partial<
      typeof LiteGraph.ContextMenu
    > as typeof LiteGraph.ContextMenu

    canvas.showLinkMenu(link, {} as CanvasPointerEvent)
    callback?.(item, null, {} as MouseEvent)
  }

  it('hides a visible link and brackets it with the change lifecycle', () => {
    const link = linkBetweenNodes()
    const before = vi.spyOn(canvas, 'emitBeforeChange')
    const dirty = vi.spyOn(canvas, 'setDirty')
    const after = vi.spyOn(canvas, 'emitAfterChange')

    clickMenuItem(link, 'Hide Link')

    expect(link.hidden).toBe(true)
    expect(before).toHaveBeenCalled()
    expect(dirty).toHaveBeenCalledWith(false, true)
    expect(after).toHaveBeenCalled()
  })

  it('shows a hidden link again', () => {
    const link = linkBetweenNodes()
    link.hidden = true

    clickMenuItem(link, 'Show Link')

    expect(link.hidden).toBe(false)
  })
})

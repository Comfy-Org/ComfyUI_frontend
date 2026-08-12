import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { LLink } from '@/lib/litegraph/src/LLink'
import {
  isLinkRevealed,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkVisibilityState'
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
    setRevealedLinks([])
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
})

describe('drawConnections hidden links', () => {
  let graph: LGraph
  let canvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    const canvasElement = document.createElement('canvas')
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
    canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
    canvas.visible_area.set([0, 0, 800, 600])
    LiteGraph.vueNodesMode = false
    setRevealedLinks([])
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
    setRevealedLinks([])
  })

  function createHiddenLink(): LLink {
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
    return link
  }

  it('draws two endpoint badges instead of a curve', () => {
    const link = createHiddenLink()

    canvas.drawConnections(createMockCtx())

    expect(canvas.renderedPaths.has(link)).toBe(false)
    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(2)
  })

  it('reveals on badge hover and clears the reveal on canvas leave', () => {
    const link = createHiddenLink()
    canvas.drawConnections(createMockCtx())
    const badge = canvas.linkBadgeFrameState.hitAreas[0]

    canvas.processMouseMove(
      new PointerEvent('pointermove', {
        clientX: badge.x + badge.width / 2,
        clientY: badge.y + badge.height / 2,
        isPrimary: false
      })
    )

    expect(isLinkRevealed(link.id)).toBe(true)

    canvas.processMouseOut(new PointerEvent('pointerout'))

    expect(isLinkRevealed(link.id)).toBe(false)
  })

  it('opens rename from a badge double-click', () => {
    const link = createHiddenLink()
    canvas.drawConnections(createMockCtx())
    const badge = canvas.linkBadgeFrameState.hitAreas[0]
    const event = new PointerEvent('pointerdown', {
      button: 0,
      clientX: badge.x + badge.width / 2,
      clientY: badge.y + badge.height / 2,
      isPrimary: false
    })
    const prompt = vi
      .spyOn(canvas, 'prompt')
      .mockReturnValue(document.createElement('div'))

    canvas.processMouseDown(event)
    canvas.pointer.onDoubleClick?.(event as CanvasPointerEvent)

    expect(prompt).toHaveBeenCalledWith(
      'Rename',
      'STRING',
      expect.any(Function),
      event
    )
    prompt.mock.calls[0][2]('  Checkpoint  ')
    expect(link.label).toBe('Checkpoint')
  })

  it('suppresses reroutes until the full routed link is revealed', () => {
    const link = createHiddenLink()
    const reroute = graph.createReroute([225, 150], link)
    if (!reroute) throw new Error('Failed to create hidden link test reroute')
    const drawReroute = vi.spyOn(reroute, 'draw')
    const renderLink = vi.spyOn(canvas, 'renderLink')

    canvas.drawConnections(createMockCtx())

    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(2)
    expect(canvas.renderedPaths.has(link)).toBe(false)
    expect(drawReroute).not.toHaveBeenCalled()
    expect(renderLink).not.toHaveBeenCalled()

    vi.stubGlobal(
      'Path2D',
      class {
        moveTo(): void {}
        lineTo(): void {}
        bezierCurveTo(): void {}
        quadraticCurveTo(): void {}
      }
    )
    setRevealedLinks([link.id])
    canvas.drawConnections(createMockCtx())

    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(2)
    expect(canvas.renderedPaths.has(link)).toBe(true)
    expect(canvas.renderedPaths.has(reroute)).toBe(true)
    expect(drawReroute).toHaveBeenCalledOnce()
    expect(renderLink).toHaveBeenCalledTimes(2)

    const [outputBadge, inputBadge] = canvas.linkBadgeFrameState.hitAreas
    const outputTip = [
      outputBadge.x + outputBadge.width,
      outputBadge.y + outputBadge.height / 2
    ]
    const inputTip = [inputBadge.x, inputBadge.y + inputBadge.height / 2]
    const firstRender = renderLink.mock.calls[0]
    const lastRender = renderLink.mock.calls.at(-1)
    expect(firstRender?.[1]).toEqual(outputTip)
    expect(lastRender?.[2]).toEqual(inputTip)
  })
})

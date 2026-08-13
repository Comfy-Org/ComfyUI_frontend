import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  CanvasPointerEvent,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import {
  isLinkRevealed,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkRevealState'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas,
  createTestLink,
  StubPath2D
} from '@/utils/__tests__/litegraphTestUtils'

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
  return createMockCanvasRenderingContext2D({
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn()
    }),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    isPointInStroke: vi.fn().mockReturnValue(false)
  })
}

describe('drawConnections widget-input slot positioning', () => {
  let graph: LGraph
  let canvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    graph = new LGraph()
    canvas = createTestCanvas(graph, createMockCtx())
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
})

describe('drawConnections hidden links', () => {
  let graph: LGraph
  let canvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia())
    graph = new LGraph()
    canvas = createTestCanvas(graph, createMockCtx())
    canvas.visible_area.set([0, 0, 800, 600])
    LiteGraph.vueNodesMode = false
    setRevealedLinks([])
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
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

  it('does not enqueue badges for an offscreen link', () => {
    const link = createHiddenLink()
    const source = graph.getNodeById(link.origin_id)
    const target = graph.getNodeById(link.target_id)
    if (!source || !target) throw new Error('Missing hidden link test nodes')
    source.pos = [-1000, -1000]
    target.pos = [-700, -1000]

    canvas.drawConnections(createMockCtx())

    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(0)
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

  it('does not reveal an occluded badge', () => {
    const link = createHiddenLink()
    canvas.drawConnections(createMockCtx())
    const badge = canvas.linkBadgeFrameState.hitAreas[0]
    const source = graph.getNodeById(link.origin_id)
    if (!source) throw new Error('Missing hidden link source node')
    vi.spyOn(graph, 'getNodeOnPos').mockReturnValue(source)

    canvas.processMouseMove(
      new PointerEvent('pointermove', {
        clientX: badge.x + badge.width / 2,
        clientY: badge.y + badge.height / 2,
        isPrimary: false
      })
    )

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
    prompt.mock.calls[0][2]('Checkpoint')
    expect(link.label).toBe('Checkpoint')
  })

  it('pans when dragging from a badge', () => {
    createHiddenLink()
    canvas.drawConnections(createMockCtx())
    const badge = canvas.linkBadgeFrameState.hitAreas[0]
    const event = new PointerEvent('pointerdown', {
      button: 0,
      clientX: badge.x + badge.width / 2,
      clientY: badge.y + badge.height / 2,
      isPrimary: false
    })

    canvas.processMouseDown(event)
    canvas.pointer.onDragStart?.(canvas.pointer)

    expect(canvas.dragging_canvas).toBe(true)
    canvas.pointer.finally?.()
    expect(canvas.dragging_canvas).toBe(false)
  })

  it('clears revealed links when the graph changes', () => {
    const link = createHiddenLink()
    setRevealedLinks([link.id])

    canvas.setGraph(new LGraph())

    expect(isLinkRevealed(link.id)).toBe(false)
  })

  it('groups output badges by source slot regardless of target node order', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [0, 100]
    sourceNode.size = [150, 80]
    sourceNode.addOutput('image', 'IMAGE')
    sourceNode.addOutput('mask', 'MASK')
    graph.add(sourceNode)

    const firstImageTarget = new LGraphNode('First image target')
    firstImageTarget.pos = [500, 100]
    firstImageTarget.addInput('image', 'IMAGE')
    graph.add(firstImageTarget)
    const firstImageLink = createTestLink(
      graph,
      sourceNode,
      0,
      firstImageTarget,
      0
    )
    firstImageLink.hidden = true

    const maskTarget = new LGraphNode('Mask target')
    maskTarget.pos = [500, 200]
    maskTarget.addInput('mask', 'MASK')
    graph.add(maskTarget)
    const maskLink = createTestLink(graph, sourceNode, 1, maskTarget, 0)
    maskLink.hidden = true

    const secondImageTarget = new LGraphNode('Second image target')
    secondImageTarget.pos = [500, 300]
    secondImageTarget.addInput('image', 'IMAGE')
    graph.add(secondImageTarget)
    const secondImageLink = createTestLink(
      graph,
      sourceNode,
      0,
      secondImageTarget,
      0
    )
    secondImageLink.hidden = true

    const thirdImageTarget = new LGraphNode('Third image target')
    thirdImageTarget.pos = [500, 400]
    thirdImageTarget.addInput('image', 'IMAGE')
    graph.add(thirdImageTarget)
    const thirdImageLink = createTestLink(
      graph,
      sourceNode,
      0,
      thirdImageTarget,
      0
    )
    thirdImageLink.hidden = true

    canvas.drawConnections(createMockCtx())

    const outputSocketX = sourceNode.getOutputPos(0)[0]
    const inputSocketX = firstImageTarget.getInputPos(0)[0]
    const outputBadgeLinkIds = canvas.linkBadgeFrameState.hitAreas
      .filter((area) => {
        const centerX = area.x + area.width / 2
        return (
          Math.abs(centerX - outputSocketX) < Math.abs(centerX - inputSocketX)
        )
      })
      .sort((first, second) => first.y - second.y)
      .map((area) => area.linkId)

    expect(outputBadgeLinkIds).toEqual([
      firstImageLink.id,
      secondImageLink.id,
      thirdImageLink.id,
      maskLink.id
    ])
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

    vi.stubGlobal('Path2D', StubPath2D)
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

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  CanvasPointerEvent,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  isLinkRevealed,
  resetLinkReveals,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkRevealState'
import { useLinkStore } from '@/stores/linkStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas,
  createTestLink,
  StubPath2D
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore')

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

describe('drawConnections', () => {
  let graph: LGraph
  let canvas: LGraphCanvas

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    canvas = createTestCanvas(graph, createMockCtx())
    LiteGraph.vueNodesMode = false
    vi.mocked(layoutStore.getNodeLayout).mockReturnValue(null)
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

  it('renders links in target z-order instead of generated id order', () => {
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
    vi.mocked(layoutStore.getNodeLayout).mockImplementation(
      (_graphId, nodeId) => ({
        id: nodeId,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        zIndex: nodeId === firstTarget.id ? 2 : 1,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: 100 }
      })
    )
    canvas.visible_area[2] = 800
    canvas.visible_area[3] = 600
    vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})

    canvas.drawConnections(createMockCtx())

    expect([...canvas.renderedPaths]).toEqual([secondLink, firstLink])
  })

  it('looks up each input and preserves rendered link identity', () => {
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    graph.add(source)

    const targets = Array.from({ length: 2 }, (_, index) => {
      const target = new LGraphNode(`Target ${index}`)
      target.addInput('connected', 'INT')
      target.addInput('unconnected', 'INT')
      graph.add(target)
      return target
    })
    const expectedLinks = targets.map((target) =>
      createTestLink(graph, source, 0, target, 0)
    )
    const inputLookup = vi.spyOn(useLinkStore(), 'getInputSlotLink')
    const resolveLink = vi.spyOn(graph, 'getLink')
    canvas.visible_area.set([0, 0, 800, 600])
    vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})

    canvas.drawConnections(createMockCtx())

    expect(inputLookup).toHaveBeenCalledTimes(4)
    expect(resolveLink).toHaveBeenCalledTimes(2)
    const renderedLinks = [...canvas.renderedPaths]
    expect(renderedLinks).toHaveLength(expectedLinks.length)
    for (const [index, expectedLink] of expectedLinks.entries()) {
      expect(renderedLinks[index]).toBe(expectedLink)
    }

    const scopes = inputLookup.mock.calls.map(([scope]) => scope)
    expect(new Set(scopes).size).toBe(1)
  })

  it.for([245, 500, 1_000])(
    'reuses render order across both passes at %i nodes',
    { timeout: 10_000 },
    (nodeCount) => {
      for (let index = 0; index < nodeCount; index++) {
        const node = new LGraphNode(`Node ${index}`)
        vi.spyOn(node, 'updateArea').mockImplementation(() => {})
        graph.add(node)
      }
      canvas.visible_area.set([0, 0, 800, 600])
      vi.mocked(layoutStore.getNodeLayout).mockClear()
      const sort = vi.spyOn(Array.prototype, 'sort')

      canvas.computeVisibleNodes()
      const foregroundLayoutReads = vi.mocked(layoutStore.getNodeLayout).mock
        .calls.length
      const foregroundSorts = sort.mock.calls.length

      canvas.drawConnections(createMockCtx())
      const totalLayoutReads = vi.mocked(layoutStore.getNodeLayout).mock.calls
        .length

      expect(foregroundLayoutReads).toBe(nodeCount)
      expect(totalLayoutReads - foregroundLayoutReads).toBe(0)
      expect(foregroundSorts).toBe(1)
      expect(
        sort.mock.instances.filter(
          (items) => Array.isArray(items) && items.length === nodeCount
        )
      ).toHaveLength(1)
    }
  )

  it.for([
    { connectedRatio: 0, fanOut: 1, hiddenEvery: 0 },
    { connectedRatio: 0.25, fanOut: 1, hiddenEvery: 2 },
    { connectedRatio: 1, fanOut: 8, hiddenEvery: 3 }
  ])(
    'scans inputs once and preserves rendered link identity at $connectedRatio occupancy and $fanOut fan-out',
    ({ connectedRatio, fanOut, hiddenEvery }) => {
      const nodeCount = 8
      const inputsPerNode = 4
      const targets = Array.from({ length: nodeCount }, (_, nodeIndex) => {
        const target = new LGraphNode(`Target ${nodeIndex}`)
        target.pos = [300, nodeIndex * 80]
        for (let slot = 0; slot < inputsPerNode; slot++) {
          target.addInput(`in ${slot}`, 'INT')
        }
        graph.add(target)
        return target
      })
      const allInputs = targets.flatMap((target) =>
        target.inputs.map((_, slot) => ({ target, slot }))
      )
      const connectedCount = Math.floor(allInputs.length * connectedRatio)
      const sources = Array.from(
        { length: Math.ceil(connectedCount / fanOut) },
        (_, sourceIndex) => {
          const source = new LGraphNode(`Source ${sourceIndex}`)
          source.pos = [0, sourceIndex * 80]
          source.addOutput('out', 'INT')
          graph.add(source)
          return source
        }
      )
      const expectedLinks = allInputs
        .slice(0, connectedCount)
        .map(({ target, slot }, index) =>
          createTestLink(
            graph,
            sources[Math.floor(index / fanOut)],
            0,
            target,
            slot
          )
        )

      vi.mocked(layoutStore.getNodeLayout).mockImplementation(
        (_graphId, nodeId) => {
          const nodeIndex = targets.findIndex((node) => node.id === nodeId)
          return {
            id: nodeId,
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            zIndex: nodeIndex,
            visible:
              !hiddenEvery || nodeIndex < 0 || nodeIndex % hiddenEvery !== 0,
            bounds: { x: 0, y: 0, width: 100, height: 100 }
          }
        }
      )
      const linkStore = useLinkStore()
      const inputLookup = vi.spyOn(linkStore, 'getInputSlotLink')
      const resolveLink = vi.spyOn(graph, 'getLink')
      canvas.visible_area.set([0, 0, 800, 3_000])
      vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})

      canvas.drawConnections(createMockCtx())

      const scannedInputs = allInputs.length
      const scopes = new Set(inputLookup.mock.calls.map(([scope]) => scope))
      expect(inputLookup).toHaveBeenCalledTimes(scannedInputs)
      expect(resolveLink).toHaveBeenCalledTimes(connectedCount)
      expect([...canvas.renderedPaths]).toEqual(expectedLinks)
      expect(scopes.size).toBe(1)
      expect(new Set(expectedLinks.map((link) => link.origin_id)).size).toBe(
        connectedCount ? Math.ceil(connectedCount / fanOut) : 0
      )

      const compatibilityIds = allInputs.map(
        ({ target, slot }) => target.inputs[slot].link
      )
      expect(compatibilityIds.filter((id) => id != null)).toEqual(
        expectedLinks.map((link) => link.id)
      )
    }
  )

  it('connects, draws, and serializes without deprecation warnings', () => {
    const sourceNode = new LGraphNode('Source')
    sourceNode.pos = [100, 100]
    sourceNode.addOutput('out', 'STRING')
    graph.add(sourceNode)

    const targetNode = new LGraphNode('Target')
    targetNode.pos = [300, 100]
    targetNode.addInput('in', 'STRING')
    graph.add(targetNode)

    const onWarning = vi.fn()
    const warningCallbacks = vi
      .spyOn(LiteGraph, 'onDeprecationWarning', 'get')
      .mockReturnValue([onWarning])

    try {
      const link = sourceNode.connect(0, targetNode, 0)
      canvas.visible_area.set([0, 0, 800, 600])
      vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})

      canvas.drawConnections(createMockCtx())
      const serialized = graph.serialize()

      expect(link).not.toBeNull()
      expect([...canvas.renderedPaths]).toEqual([link])
      expect(serialized.links).toHaveLength(1)
      expect(onWarning).not.toHaveBeenCalled()
    } finally {
      warningCallbacks.mockRestore()
    }
  })

  it('isolates subgraph rendering from root-graph topology', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const [subgraphSource, subgraphTarget] = subgraph.nodes
    const subgraphLink = subgraphSource.connect(0, subgraphTarget, 0)!

    const rootSource = new LGraphNode('Root source')
    rootSource.addOutput('out', '*')
    subgraph.rootGraph.add(rootSource)
    const rootTarget = new LGraphNode('Root target')
    rootTarget.addInput('in', '*')
    subgraph.rootGraph.add(rootTarget)
    const rootLink = rootSource.connect(0, rootTarget, 0)!
    canvas.setGraph(subgraph)
    canvas.visible_area.set([0, 0, 800, 600])
    const inputLookup = vi.spyOn(useLinkStore(), 'getInputSlotLink')
    vi.spyOn(canvas, 'renderLink').mockImplementation(() => {})
    inputLookup.mockClear()

    canvas.drawConnections(createMockCtx())

    expect([...canvas.renderedPaths]).toEqual([subgraphLink])
    expect(canvas.renderedPaths).not.toContain(rootLink)
    expect(
      new Set(inputLookup.mock.calls.map(([scope]) => scope.owningGraphId))
    ).toEqual(new Set([subgraph.id]))
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    canvas = createTestCanvas(graph, createMockCtx())
    canvas.visible_area.set([0, 0, 800, 600])
    LiteGraph.vueNodesMode = false
    resetLinkReveals()
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

  it('keeps offscreen badge rows for stable stacking but skips their paint', () => {
    const link = createHiddenLink()
    const source = graph.getNodeById(link.origin_id)
    const target = graph.getNodeById(link.target_id)
    if (!source || !target) throw new Error('Missing hidden link test nodes')
    source.pos = [-1000, -1000]
    target.pos = [-700, -1000]

    canvas.drawConnections(createMockCtx())

    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(2)
    expect(canvas.linkBadgeFrameState.pendingBadges).toHaveLength(0)
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

    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(true)

    canvas.processMouseOut(new PointerEvent('pointerout'))

    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(false)
  })

  it('releases the badge-hover reveal after the last badge disappears', () => {
    vi.stubGlobal('Path2D', StubPath2D)
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
    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(true)

    link.hidden = false
    canvas.drawConnections(createMockCtx())
    canvas.processMouseMove(
      new PointerEvent('pointermove', {
        clientX: 500,
        clientY: 500,
        isPrimary: false
      })
    )

    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(false)
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

    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(false)
  })

  it('skips node occlusion lookup in Vue mode when there are no badges', () => {
    LiteGraph.vueNodesMode = true
    const getNodeOnPos = vi.spyOn(graph, 'getNodeOnPos')

    canvas.processMouseMove(
      new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 100,
        isPrimary: false
      })
    )

    expect(getNodeOnPos).not.toHaveBeenCalled()
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
      '',
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

  it('clears revealed links and badge hit areas when the graph changes', () => {
    const link = createHiddenLink()
    canvas.drawConnections(createMockCtx())
    setRevealedLinks(graph.rootGraph.id, [link.id], canvas)
    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(2)

    canvas.setGraph(new LGraph())

    expect(isLinkRevealed(graph.rootGraph.id, link.id)).toBe(false)
    expect(canvas.linkBadgeFrameState.hitAreas).toHaveLength(0)
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
    const revealOwner = {}
    setRevealedLinks(graph.rootGraph.id, [link.id], revealOwner)
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

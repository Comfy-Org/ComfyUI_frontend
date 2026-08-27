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
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore')

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
    'rebuilds render order independently for both passes at %i nodes',
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
      expect(totalLayoutReads - foregroundLayoutReads).toBe(nodeCount)
      expect(foregroundSorts).toBe(1)
      expect(
        sort.mock.instances.filter(
          (items) => Array.isArray(items) && items.length === nodeCount
        )
      ).toHaveLength(2)
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
